import "server-only";

import { getAppSettingsCollection } from "./db";
import { getApifyActorOptions, getDefaultApifyActorId, resolveApifyActorOption } from "./apify-actors";
import { HttpError } from "./http";
import type { ApifyActorSettingsDTO } from "@/types/app";

const GLOBAL_SETTINGS_KEY = "global";

export async function getApifyActorSettings(): Promise<ApifyActorSettingsDTO> {
  const collection = await getAppSettingsCollection();
  const record = await collection.findOne({ key: GLOBAL_SETTINGS_KEY });
  const actorId = record?.apifyActorId ?? getDefaultApifyActorId();

  return {
    selectedActorId: actorId,
    selectedActor: resolveApifyActorOption(actorId),
    actors: getApifyActorOptions(),
    updatedAt: record?.updatedAt.toISOString() ?? null,
  };
}

export async function updateApifyActorSettings(actorId: string) {
  const actorOptions = getApifyActorOptions();
  const actor = actorOptions.find((option) => option.id === actorId);

  if (!actor) {
    throw new HttpError("Unsupported Apify actor selected.", 400, "INVALID_APIFY_ACTOR");
  }

  const collection = await getAppSettingsCollection();
  const now = new Date();

  await collection.updateOne(
    { key: GLOBAL_SETTINGS_KEY },
    {
      $set: {
        apifyActorId: actor.id,
        updatedAt: now,
      },
      $setOnInsert: {
        key: GLOBAL_SETTINGS_KEY,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return getApifyActorSettings();
}
