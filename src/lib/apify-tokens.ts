import "server-only";

import { ObjectId } from "mongodb";
import { getApifyTokenCollection } from "./db";
import { HttpError } from "./http";
import { ApifyTokenRecord } from "./models";
import { ApifyTokenDTO } from "@/types/app";

const APIFY_LIMITS_URL = "https://api.apify.com/v2/users/me/limits";

type ApifyTokenUsageSnapshot = {
  monthlyUsageUsd: number | null;
  maxMonthlyUsageUsd: number | null;
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  usageFetchedAt: string | null;
  usageError: string | null;
};

type ApifyLimitsResponse = {
  data?: {
    monthlyUsageCycle?: {
      startAt?: string;
      endAt?: string;
    };
    limits?: {
      maxMonthlyUsageUsd?: number;
    };
    current?: {
      monthlyUsageUsd?: number;
    };
  };
};

export async function listApifyTokensWithUsage(): Promise<ApifyTokenDTO[]> {
  const collection = await getApifyTokenCollection();
  const tokens = await collection.find().sort({ isActive: -1, updatedAt: -1 }).toArray();
  const usage = await Promise.all(tokens.map((token) => fetchApifyTokenUsage(token.token)));

  return tokens.map((token, index) => toApifyTokenDto(token, usage[index]));
}

export async function createApifyToken(input: {
  token: string;
  metadata: string;
  activate?: boolean;
}) {
  const collection = await getApifyTokenCollection();
  const now = new Date();
  const activeToken = await collection.findOne({ isActive: true });
  const shouldActivate = input.activate || !activeToken;

  if (shouldActivate) {
    await collection.updateMany({ isActive: true }, { $set: { isActive: false, updatedAt: now } });
  }

  const result = await collection.insertOne({
    token: input.token,
    metadata: input.metadata,
    isActive: shouldActivate,
    createdAt: now,
    updatedAt: now,
  });

  return collection.findOne({ _id: result.insertedId });
}

export async function updateApifyToken(
  tokenId: string,
  input: {
    token?: string;
    metadata?: string;
    activate?: boolean;
  },
) {
  const collection = await getApifyTokenCollection();
  const objectId = parseTokenId(tokenId);
  const existing = await collection.findOne({ _id: objectId });

  if (!existing) {
    throw new HttpError("Apify token not found.", 404, "APIFY_TOKEN_NOT_FOUND");
  }

  const now = new Date();

  if (input.activate) {
    await collection.updateMany({ isActive: true }, { $set: { isActive: false, updatedAt: now } });
  }

  await collection.updateOne(
    { _id: objectId },
    {
      $set: {
        ...(input.token ? { token: input.token } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(input.activate ? { isActive: true } : {}),
        updatedAt: now,
      },
    },
  );

  return collection.findOne({ _id: objectId });
}

export async function deleteApifyToken(tokenId: string) {
  const collection = await getApifyTokenCollection();
  const objectId = parseTokenId(tokenId);
  const result = await collection.findOneAndDelete({ _id: objectId });

  if (!result) {
    throw new HttpError("Apify token not found.", 404, "APIFY_TOKEN_NOT_FOUND");
  }

  return result;
}

export async function requireActiveApifyToken() {
  const collection = await getApifyTokenCollection();
  const token = await collection.findOne({ isActive: true });

  if (!token) {
    throw new HttpError(
      "No active Apify token is configured. An admin needs to activate one before searches can run.",
      503,
      "APIFY_TOKEN_REQUIRED",
    );
  }

  return token;
}

function parseTokenId(tokenId: string) {
  if (!ObjectId.isValid(tokenId)) {
    throw new HttpError("Invalid Apify token id.", 400, "INVALID_APIFY_TOKEN_ID");
  }

  return new ObjectId(tokenId);
}

function toApifyTokenDto(record: ApifyTokenRecord, usage: ApifyTokenUsageSnapshot): ApifyTokenDTO {
  return {
    id: record._id?.toString() ?? "",
    metadata: record.metadata,
    tokenPreview: maskToken(record.token),
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    monthlyUsageUsd: usage.monthlyUsageUsd,
    maxMonthlyUsageUsd: usage.maxMonthlyUsageUsd,
    cycleStartAt: usage.cycleStartAt,
    cycleEndAt: usage.cycleEndAt,
    usageFetchedAt: usage.usageFetchedAt,
    usageError: usage.usageError,
  };
}

async function fetchApifyTokenUsage(token: string): Promise<ApifyTokenUsageSnapshot> {
  const usageFetchedAt = new Date().toISOString();

  try {
    const response = await fetch(APIFY_LIMITS_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    const payload = (await response.json().catch(() => null)) as ApifyLimitsResponse | null;

    if (!response.ok) {
      throw new Error(
        typeof payload === "object" && payload && "error" in payload
          ? String(payload.error)
          : `Apify returned ${response.status}.`,
      );
    }

    return {
      monthlyUsageUsd: asNumber(payload?.data?.current?.monthlyUsageUsd),
      maxMonthlyUsageUsd: asNumber(payload?.data?.limits?.maxMonthlyUsageUsd),
      cycleStartAt: payload?.data?.monthlyUsageCycle?.startAt ?? null,
      cycleEndAt: payload?.data?.monthlyUsageCycle?.endAt ?? null,
      usageFetchedAt,
      usageError: null,
    };
  } catch (error) {
    return {
      monthlyUsageUsd: null,
      maxMonthlyUsageUsd: null,
      cycleStartAt: null,
      cycleEndAt: null,
      usageFetchedAt,
      usageError: error instanceof Error ? error.message : "Unable to load usage from Apify.",
    };
  }
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function maskToken(token: string) {
  if (token.length <= 12) {
    return `${token.slice(0, 4)}...${token.slice(-2)}`;
  }

  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}
