import "server-only";

import type { LinkedInProfile } from "@/types/linkedin";
import { scrapeLinkedInProfile, scrapeLinkedInProfiles } from "./apify";
import { getSearchCollection, getSearchEventCollection, getUserCollection } from "./db";
import type { SearchEventRecord, SearchRecord, UserRecord } from "./models";
import { normalizeLinkedInUrl } from "./validation";

export type SearchFinderDTO = {
  id: string;
  username: string;
  foundAt: string;
};

export type LinkedInSearchResultDTO = {
  id: string;
  url: string;
  profile: LinkedInProfile;
  source: "cache" | "fresh";
  createdAt: string;
  foundBy: SearchFinderDTO | null;
};

export type LinkedInBatchSearchItemDTO = {
  inputUrl: string;
  url: string;
  profile: LinkedInProfile | null;
  source: "cache" | "fresh" | null;
  status: "exists" | "newly_found" | "error";
  createdAt: string | null;
  foundBy: SearchFinderDTO | null;
  error: string | null;
};

type SearchEventCollection = Awaited<ReturnType<typeof getSearchEventCollection>>;
type SearchCollection = Awaited<ReturnType<typeof getSearchCollection>>;

export async function searchLinkedInUrl(url: string, user: UserRecord): Promise<LinkedInSearchResultDTO> {
  const collection = await getSearchCollection();
  const searchEvents = await getSearchEventCollection();
  const now = new Date();

  return searchNormalizedLinkedInUrl(url, user, collection, searchEvents, now);
}

export async function searchLinkedInUrls(rawUrls: string[], user: UserRecord): Promise<LinkedInBatchSearchItemDTO[]> {
  const collection = await getSearchCollection();
  const searchEvents = await getSearchEventCollection();
  const now = new Date();
  const trimmedInputs = rawUrls.map((value) => value.trim()).filter(Boolean);

  const parsedInputs = trimmedInputs.map((inputUrl) => {
    try {
      return {
        inputUrl,
        normalizedUrl: normalizeLinkedInUrl(inputUrl),
        error: null as string | null,
      };
    } catch (error) {
      return {
        inputUrl,
        normalizedUrl: null,
        error: resolveSearchErrorMessage(error, "Invalid LinkedIn URL."),
      };
    }
  });

  const uniqueValidUrls = Array.from(
    new Set(parsedInputs.flatMap((item) => (item.normalizedUrl ? [item.normalizedUrl] : []))),
  );

  const outcomeByUrl = new Map<string, LinkedInBatchSearchItemDTO>();
  const existingRecords = uniqueValidUrls.length
    ? await collection.find({ url: { $in: uniqueValidUrls } }).toArray()
    : [];
  const existingByUrl = new Map(existingRecords.map((record) => [record.url, record]));

  for (const url of uniqueValidUrls) {
    const cachedRecord = existingByUrl.get(url);
    if (!cachedRecord) {
      continue;
    }

    try {
      const result = await hydrateCachedSearchResult(cachedRecord, user, collection, searchEvents, now);
      outcomeByUrl.set(url, toBatchSearchItem("", result, "exists"));
    } catch (error) {
      outcomeByUrl.set(
        url,
        buildErrorBatchSearchItem("", url, resolveSearchErrorMessage(error, "Unable to load cached profile.")),
      );
    }
  }

  const uncachedUrls = uniqueValidUrls.filter((url) => !existingByUrl.has(url));
  let scrapedByUrl = new Map<string, LinkedInProfile>();
  let scrapeFailure: string | null = null;

  if (uncachedUrls.length) {
    try {
      scrapedByUrl = await scrapeLinkedInProfiles(uncachedUrls);
    } catch (error) {
      scrapeFailure = resolveSearchErrorMessage(error, "Unable to run the Apify scrape.");
    }
  }

  for (const url of uncachedUrls) {
    try {
      const profile = scrapedByUrl.get(url);

      if (!profile) {
        outcomeByUrl.set(
          url,
          buildErrorBatchSearchItem(
            "",
            url,
            scrapeFailure ?? "No profile data was returned for this LinkedIn URL.",
          ),
        );
        continue;
      }

      const result = await persistScrapedProfile(url, profile, user, collection, searchEvents, now);
      outcomeByUrl.set(url, toBatchSearchItem("", result, result.source === "fresh" ? "newly_found" : "exists"));
    } catch (error) {
      outcomeByUrl.set(
        url,
        buildErrorBatchSearchItem("", url, resolveSearchErrorMessage(error, "Unable to save the scraped profile.")),
      );
    }
  }

  return parsedInputs.map((item) => {
    if (!item.normalizedUrl || item.error) {
      return buildErrorBatchSearchItem(item.inputUrl, item.inputUrl, item.error ?? "Invalid LinkedIn URL.");
    }

    const outcome =
      outcomeByUrl.get(item.normalizedUrl) ??
      buildErrorBatchSearchItem(item.inputUrl, item.normalizedUrl, "Unexpected batch search error.");

    return {
      ...outcome,
      inputUrl: item.inputUrl,
    };
  });
}

async function searchNormalizedLinkedInUrl(
  url: string,
  user: UserRecord,
  collection: SearchCollection,
  searchEvents: SearchEventCollection,
  now: Date,
) {
  const existing = await collection.findOne({ url });

  if (existing) {
    return hydrateCachedSearchResult(existing, user, collection, searchEvents, now);
  }

  const profile = await scrapeLinkedInProfile(url);
  return persistScrapedProfile(url, profile, user, collection, searchEvents, now);
}

async function hydrateCachedSearchResult(
  record: SearchRecord,
  user: UserRecord,
  collection: SearchCollection,
  searchEvents: SearchEventCollection,
  now: Date,
): Promise<LinkedInSearchResultDTO> {
  if (!record._id) {
    throw new Error("Cached search record is missing an id.");
  }

  const foundBy = await findProfileFinder(searchEvents, record._id, record.url);

  await collection.updateOne({ _id: record._id }, { $set: { updatedAt: now } });
  await logSearchEvent(searchEvents, user, record.url, "cache", record._id, now);

  return {
    id: record._id.toString(),
    url: record.url,
    profile: record.profile,
    source: "cache",
    createdAt: record.createdAt.toISOString(),
    foundBy,
  };
}

async function persistScrapedProfile(
  url: string,
  profile: LinkedInProfile,
  user: UserRecord,
  collection: SearchCollection,
  searchEvents: SearchEventCollection,
  now: Date,
): Promise<LinkedInSearchResultDTO> {
  try {
    const result = await collection.insertOne({
      url,
      profile,
      createdAt: now,
      updatedAt: now,
      source: "fresh",
    });

    await logSearchEvent(searchEvents, user, url, "fresh", result.insertedId, now);

    return {
      id: result.insertedId.toString(),
      url,
      profile,
      source: "fresh",
      createdAt: now.toISOString(),
      foundBy: null,
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const cachedRecord = await collection.findOne({ url });
    if (!cachedRecord) {
      throw new Error("Unable to load cached search after duplicate insert.");
    }

    return hydrateCachedSearchResult(cachedRecord, user, collection, searchEvents, now);
  }
}

async function logSearchEvent(
  searchEvents: SearchEventCollection,
  user: UserRecord,
  url: string,
  source: "cache" | "fresh",
  searchRecordId: SearchEventRecord["searchRecordId"],
  createdAt: Date,
) {
  if (!user._id) {
    throw new Error("Cannot log a search for a user without an id.");
  }

  await searchEvents.insertOne({
    userId: user._id,
    username: user.username,
    url,
    source,
    searchRecordId,
    createdAt,
  });
}

async function findProfileFinder(
  searchEvents: SearchEventCollection,
  searchRecordId: SearchEventRecord["searchRecordId"],
  url: string,
): Promise<SearchFinderDTO | null> {
  const event =
    (searchRecordId
      ? await searchEvents.findOne({ searchRecordId, source: "fresh" }, { sort: { createdAt: 1 } })
      : null) ??
    (await searchEvents.findOne({ url, source: "fresh" }, { sort: { createdAt: 1 } })) ??
    (searchRecordId ? await searchEvents.findOne({ searchRecordId }, { sort: { createdAt: 1 } }) : null) ??
    (await searchEvents.findOne({ url }, { sort: { createdAt: 1 } }));

  if (!event) {
    return null;
  }

  const users = await getUserCollection();
  const user = await users.findOne({ _id: event.userId });

  return {
    id: (user?._id ?? event.userId).toString(),
    username: user?.username ?? event.username,
    foundAt: event.createdAt.toISOString(),
  };
}

function toBatchSearchItem(
  inputUrl: string,
  result: LinkedInSearchResultDTO,
  status: LinkedInBatchSearchItemDTO["status"],
): LinkedInBatchSearchItemDTO {
  return {
    inputUrl,
    url: result.url,
    profile: result.profile,
    source: result.source,
    status,
    createdAt: result.createdAt,
    foundBy: result.foundBy,
    error: null,
  };
}

function buildErrorBatchSearchItem(inputUrl: string, url: string, error: string): LinkedInBatchSearchItemDTO {
  return {
    inputUrl,
    url,
    profile: null,
    source: null,
    status: "error",
    createdAt: null,
    foundBy: null,
    error,
  };
}

function resolveSearchErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
