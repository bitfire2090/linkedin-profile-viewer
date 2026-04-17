import { ApifyClient } from "apify-client";
import { requireActiveApifyToken } from "./apify-tokens";
import { LinkedInProfile } from "@/types/linkedin";
import { normalizeLinkedInUrl } from "./validation";

const DEFAULT_ACTOR_ID = process.env.APIFY_ACTOR_ID;
const DEFAULT_PROFILE_MODE =
  process.env.APIFY_PROFILE_MODE ?? "Profile details no email ($4 per 1k)";

async function getClient() {
  const token = await requireActiveApifyToken();
  return new ApifyClient({ token: token.token });
}

function getActorId() {
  if (!DEFAULT_ACTOR_ID) {
    throw new Error("APIFY_ACTOR_ID is required to call the scraper.");
  }
  return DEFAULT_ACTOR_ID;
}

export async function scrapeLinkedInProfile(linkedinUrl: string) {
  const profiles = await scrapeLinkedInProfiles([linkedinUrl]);
  const profile = profiles.get(linkedinUrl) ?? Array.from(profiles.values())[0] ?? null;

  if (!profile) {
    throw new Error("No profile data returned from Apify actor.");
  }

  return profile;
}

export async function scrapeLinkedInProfiles(linkedinUrls: string[]) {
  const client = await getClient();
  const actorId = getActorId();
  const uniqueUrls = Array.from(new Set(linkedinUrls));

  const { defaultDatasetId } = await client.actor(actorId).call({
    profileScraperMode: DEFAULT_PROFILE_MODE,
    queries: uniqueUrls,
  });

  if (!defaultDatasetId) {
    throw new Error("Apify did not return a dataset id.");
  }

  const { items } = await client.dataset(defaultDatasetId).listItems({ limit: uniqueUrls.length });
  const profilesByUrl = new Map<string, LinkedInProfile>();
  const requestedUrls = new Set(uniqueUrls);

  for (const item of items ?? []) {
    const profile = item as LinkedInProfile;

    for (const key of collectProfileLookupKeys(profile)) {
      if (!requestedUrls.has(key) || profilesByUrl.has(key)) {
        continue;
      }

      profilesByUrl.set(key, profile);
      break;
    }
  }

  return profilesByUrl;
}

function collectProfileLookupKeys(profile: LinkedInProfile) {
  const keys = [
    safeNormalizeLinkedInUrl(profile.originalQuery?.query),
    safeNormalizeLinkedInUrl(profile.linkedinUrl),
    profile.publicIdentifier
      ? safeNormalizeLinkedInUrl(`https://www.linkedin.com/in/${profile.publicIdentifier}`)
      : null,
  ].filter(Boolean) as string[];

  return Array.from(new Set(keys));
}

function safeNormalizeLinkedInUrl(rawUrl?: string) {
  if (!rawUrl) {
    return null;
  }

  try {
    return normalizeLinkedInUrl(rawUrl);
  } catch {
    return null;
  }
}
