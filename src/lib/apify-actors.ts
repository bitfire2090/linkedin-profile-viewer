export const UNSEENUSER_LINKEDIN_PROFILE_ACTOR_ID = "unseenuser/LinkedIn-Profile";

export type ApifyActorInputKind = "profileScraperModeQueries" | "queriesOnly";
export type ApifyActorOutputKind = "currentProfile" | "unseenuserLinkedInProfile";

export interface ApifyActorOption {
  id: string;
  label: string;
  description: string;
  inputKind: ApifyActorInputKind;
  outputKind: ApifyActorOutputKind;
}

export function getDefaultApifyActorId() {
  return process.env.APIFY_ACTOR_ID || UNSEENUSER_LINKEDIN_PROFILE_ACTOR_ID;
}

export function getApifyActorOptions(): ApifyActorOption[] {
  const options: ApifyActorOption[] = [];
  const configuredActorId = process.env.APIFY_ACTOR_ID;

  if (configuredActorId && configuredActorId !== UNSEENUSER_LINKEDIN_PROFILE_ACTOR_ID) {
    options.push({
      id: configuredActorId,
      label: "Configured LinkedIn profile actor",
      description: "Current actor from APIFY_ACTOR_ID. Uses profileScraperMode and queries input.",
      inputKind: "profileScraperModeQueries",
      outputKind: "currentProfile",
    });
  }

  options.push({
    id: UNSEENUSER_LINKEDIN_PROFILE_ACTOR_ID,
    label: "UnseenUser LinkedIn Profile",
    description: "No-login LinkedIn Profile actor. Uses queries input and normalizes output to the app profile type.",
    inputKind: "queriesOnly",
    outputKind: "unseenuserLinkedInProfile",
  });

  return options;
}

export function resolveApifyActorOption(actorId: string): ApifyActorOption {
  const matched = getApifyActorOptions().find((actor) => actor.id === actorId);

  if (matched) {
    return matched;
  }

  if (actorId === UNSEENUSER_LINKEDIN_PROFILE_ACTOR_ID) {
    return getApifyActorOptions().find((actor) => actor.id === actorId)!;
  }

  return {
    id: actorId,
    label: actorId,
    description: "Custom configured actor. Uses profileScraperMode and queries input.",
    inputKind: "profileScraperModeQueries",
    outputKind: "currentProfile",
  };
}
