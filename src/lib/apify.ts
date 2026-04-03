import { ApifyClient } from "apify-client";
import { requireActiveApifyToken } from "./apify-tokens";
import { LinkedInProfile } from "@/types/linkedin";

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
  const client = await getClient();
  const actorId = getActorId();

  const { defaultDatasetId } = await client.actor(actorId).call({
    profileScraperMode: DEFAULT_PROFILE_MODE,
    queries: [linkedinUrl],
  });

  const { items } = await client.dataset(defaultDatasetId).listItems({ limit: 1 });
  const profile = (items?.[0] as LinkedInProfile | undefined) ?? null;

  if (!profile) {
    throw new Error("No profile data returned from Apify actor.");
  }

  return profile;
}
