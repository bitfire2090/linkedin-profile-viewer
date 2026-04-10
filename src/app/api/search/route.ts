import { NextResponse } from "next/server";
import { scrapeLinkedInProfile } from "@/lib/apify";
import { requireApprovedUser } from "@/lib/auth";
import { getSearchCollection, getSearchEventCollection, getUserCollection } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import type { SearchEventRecord } from "@/lib/models";
import { searchBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type SearchFinderDTO = {
  id: string;
  username: string;
  foundAt: string;
};

type SearchEventCollection = Awaited<ReturnType<typeof getSearchEventCollection>>;

export async function POST(request: Request) {
  try {
    const { user } = await requireApprovedUser();
    const payload = await request.json();
    const { url } = searchBodySchema.parse(payload);
    const collection = await getSearchCollection();
    const searchEvents = await getSearchEventCollection();
    const now = new Date();
    const existing = await collection.findOne({ url });

    if (existing) {
      const foundBy = await findProfileFinder(searchEvents, existing._id, url);

      await collection.updateOne({ _id: existing._id }, { $set: { updatedAt: now } });
      await searchEvents.insertOne({
        userId: user._id!,
        username: user.username,
        url,
        source: "cache",
        searchRecordId: existing._id ?? null,
        createdAt: now,
      });

      return NextResponse.json({
        id: existing._id?.toString() ?? "",
        url: existing.url,
        profile: existing.profile,
        source: "cache" as const,
        createdAt: (existing.createdAt ?? new Date()).toISOString(),
        foundBy,
      });
    }

    const profile = await scrapeLinkedInProfile(url);
    let insertedId;
    const responseSource: "cache" | "fresh" = "fresh";

    try {
      const result = await collection.insertOne({
        url,
        profile,
        createdAt: now,
        updatedAt: now,
        source: "fresh",
      });
      insertedId = result.insertedId;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const cachedRecord = await collection.findOne({ url });
      if (!cachedRecord) {
        throw new Error("Unable to load cached search after duplicate insert.");
      }

      const foundBy = await findProfileFinder(searchEvents, cachedRecord._id, url);

      await collection.updateOne({ _id: cachedRecord._id }, { $set: { updatedAt: now } });
      await searchEvents.insertOne({
        userId: user._id!,
        username: user.username,
        url,
        source: "cache",
        searchRecordId: cachedRecord._id ?? null,
        createdAt: now,
      });

      return NextResponse.json({
        id: cachedRecord._id?.toString() ?? "",
        url: cachedRecord.url,
        profile: cachedRecord.profile,
        source: "cache" as const,
        createdAt: (cachedRecord.createdAt ?? now).toISOString(),
        foundBy,
      });
    }

    await searchEvents.insertOne({
      userId: user._id!,
      username: user.username,
      url,
      source: responseSource,
      searchRecordId: insertedId ?? null,
      createdAt: now,
    });

    return NextResponse.json({
      id: insertedId?.toString() ?? "",
      url,
      profile,
      source: responseSource,
      createdAt: now.toISOString(),
      foundBy: null,
    });
  } catch (error) {
    return handleRouteError(error, "Search API error");
  }
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

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
