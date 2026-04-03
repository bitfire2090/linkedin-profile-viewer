import "server-only";

import { Filter } from "mongodb";
import { getSearchCollection, getSearchEventCollection, getSessionCollection, getUserCollection } from "./db";
import { toUserDto } from "./auth";
import { HttpError } from "./http";
import { SearchEventRecord } from "./models";
import {
  RecentSearchActivityDTO,
  UsageDashboardDTO,
  UsageFilterDTO,
  UsagePreset,
  UsageUserSummaryDTO,
} from "@/types/app";

type UserUsageAggregate = {
  _id: string;
  totalSearches: number;
  freshSearches: number;
  cachedSearches: number;
  lastSearchAt: Date | null;
};

export type UsageFilterInput = {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
};

type ResolvedUsageFilter = UsageFilterDTO & {
  match: Filter<SearchEventRecord>;
};

export async function buildUsageDashboard(
  currentUserId: string,
  input: UsageFilterInput = {},
): Promise<UsageDashboardDTO> {
  const filter = resolveUsageFilter(input);
  const usersCollection = await getUserCollection();
  const sessionsCollection = await getSessionCollection();
  const searchesCollection = await getSearchCollection();
  const searchEventsCollection = await getSearchEventCollection();
  const now = new Date();

  const [users, usageRows, recentSearchesRaw, activeSessions, cachedProfiles] = await Promise.all([
    usersCollection.find().sort({ createdAt: 1 }).toArray(),
    searchEventsCollection
      .aggregate<UserUsageAggregate>([
        { $match: filter.match },
        {
          $group: {
            _id: { $toString: "$userId" },
            totalSearches: { $sum: 1 },
            freshSearches: {
              $sum: {
                $cond: [{ $eq: ["$source", "fresh"] }, 1, 0],
              },
            },
            cachedSearches: {
              $sum: {
                $cond: [{ $eq: ["$source", "cache"] }, 1, 0],
              },
            },
            lastSearchAt: { $max: "$createdAt" },
          },
        },
      ])
      .toArray(),
    searchEventsCollection.find(filter.match).sort({ createdAt: -1 }).limit(12).toArray(),
    sessionsCollection.countDocuments({ expiresAt: { $gt: now } }),
    searchesCollection.countDocuments(),
  ]);

  const usageMap = new Map(usageRows.map((row) => [row._id, row]));

  const userSummaries: UsageUserSummaryDTO[] = users
    .map((user) => {
      const usage = usageMap.get(user._id?.toString() ?? "");

      return {
        ...toUserDto(user),
        totalSearches: usage?.totalSearches ?? 0,
        freshSearches: usage?.freshSearches ?? 0,
        cachedSearches: usage?.cachedSearches ?? 0,
        lastSearchAt: usage?.lastSearchAt ? usage.lastSearchAt.toISOString() : null,
      };
    })
    .sort((a, b) => {
      if (b.freshSearches !== a.freshSearches) {
        return b.freshSearches - a.freshSearches;
      }
      if (b.totalSearches !== a.totalSearches) {
        return b.totalSearches - a.totalSearches;
      }
      return a.username.localeCompare(b.username);
    });

  const recentSearches: RecentSearchActivityDTO[] = recentSearchesRaw.map((item) => ({
    id: item._id?.toString() ?? "",
    username: item.username,
    url: item.url,
    source: item.source,
    createdAt: item.createdAt.toISOString(),
  }));

  const currentUser =
    userSummaries.find((item) => item.id === currentUserId) ??
    userSummaries[0] ?? {
      id: currentUserId,
      username: "",
      role: "user",
      status: "approved",
      approved: true,
      disabled: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      approvedAt: now.toISOString(),
      lastLoginAt: now.toISOString(),
      totalSearches: 0,
      freshSearches: 0,
      cachedSearches: 0,
      lastSearchAt: null,
    };

  const totals = {
    totalUsers: users.length,
    approvedUsers: users.filter((user) => user.approved && !user.disabledAt).length,
    pendingUsers: users.filter((user) => !user.approved && !user.disabledAt).length,
    disabledUsers: users.filter((user) => Boolean(user.disabledAt)).length,
    activeSessions,
    cachedProfiles,
    totalSearches: userSummaries.reduce((sum, item) => sum + item.totalSearches, 0),
    freshSearches: userSummaries.reduce((sum, item) => sum + item.freshSearches, 0),
    cachedSearches: userSummaries.reduce((sum, item) => sum + item.cachedSearches, 0),
  };

  return {
    filter: {
      preset: filter.preset,
      label: filter.label,
      startDate: filter.startDate,
      endDate: filter.endDate,
    },
    totals,
    currentUser,
    users: userSummaries,
    recentSearches,
  };
}

function resolveUsageFilter(input: UsageFilterInput): ResolvedUsageFilter {
  const requestedPreset = (input.preset ?? "today") as UsagePreset;
  const preset: UsagePreset = isUsagePreset(requestedPreset) ? requestedPreset : "today";
  const today = startOfDayLocal(new Date());

  if (preset === "total") {
    return {
      preset,
      label: "Total",
      startDate: null,
      endDate: null,
      match: {},
    };
  }

  if (preset === "today") {
    return buildRangeFilter(preset, today, addDaysLocal(today, 1), "Today");
  }

  if (preset === "last3days") {
    return buildRangeFilter(preset, addDaysLocal(today, -2), addDaysLocal(today, 1), "Last 3 days");
  }

  if (preset === "lastWeek") {
    return buildRangeFilter(preset, addDaysLocal(today, -6), addDaysLocal(today, 1), "Last 7 days");
  }

  if (preset === "lastMonth") {
    return buildRangeFilter(preset, addDaysLocal(today, -29), addDaysLocal(today, 1), "Last 30 days");
  }

  const startText = input.start?.trim();
  const endText = input.end?.trim();

  if (!startText || !endText) {
    throw new HttpError("Custom usage range requires both start and end dates.", 400, "INVALID_USAGE_RANGE");
  }

  const startDate = parseDateInput(startText);
  const endDate = parseDateInput(endText);

  if (endDate < startDate) {
    throw new HttpError("Custom usage range end date must be on or after the start date.", 400, "INVALID_USAGE_RANGE");
  }

  return buildRangeFilter(
    preset,
    startDate,
    addDaysLocal(endDate, 1),
    `${toLocalDateInput(startDate)} to ${toLocalDateInput(endDate)}`,
  );
}

function buildRangeFilter(
  preset: UsagePreset,
  start: Date,
  endExclusive: Date,
  label: string,
): ResolvedUsageFilter {
  return {
    preset,
    label,
    startDate: toLocalDateInput(start),
    endDate: toLocalDateInput(addDaysLocal(endExclusive, -1)),
    match: {
      createdAt: {
        $gte: start,
        $lt: endExclusive,
      },
    },
  };
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new HttpError("Usage dates must be in YYYY-MM-DD format.", 400, "INVALID_USAGE_RANGE");
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);
  parsed.setHours(0, 0, 0, 0);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    throw new HttpError("Usage dates must be valid calendar dates.", 400, "INVALID_USAGE_RANGE");
  }

  return parsed;
}

function startOfDayLocal(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDaysLocal(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function toLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isUsagePreset(value: string): value is UsagePreset {
  return ["today", "last3days", "lastWeek", "lastMonth", "total", "custom"].includes(value);
}
