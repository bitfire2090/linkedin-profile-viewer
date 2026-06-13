import { ApifyClient } from "apify-client";
import { requireActiveApifyToken } from "./apify-tokens";
import { getApifyActorSettings } from "./apify-settings";
import type { ApifyActorOption } from "./apify-actors";
import { CertificationItem, DateRangePart, ImageAsset, LinkedInProfile } from "@/types/linkedin";
import { normalizeLinkedInUrl } from "./validation";

const DEFAULT_PROFILE_MODE =
  process.env.APIFY_PROFILE_MODE ?? "Profile details no email ($4 per 1k)";

async function getClient() {
  const token = await requireActiveApifyToken();
  return new ApifyClient({ token: token.token });
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
  const settings = await getApifyActorSettings();
  const actor = settings.selectedActor;
  const uniqueUrls = Array.from(new Set(linkedinUrls));

  const { defaultDatasetId } = await client.actor(actor.id).call(buildActorInput(actor, uniqueUrls));

  if (!defaultDatasetId) {
    throw new Error("Apify did not return a dataset id.");
  }

  const { items } = await client.dataset(defaultDatasetId).listItems({ limit: uniqueUrls.length });
  const profilesByUrl = new Map<string, LinkedInProfile>();
  const requestedUrls = new Set(uniqueUrls);

  for (const item of items ?? []) {
    const profile = normalizeActorProfile(item, actor);

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

function buildActorInput(actor: ApifyActorOption, queries: string[]) {
  if (actor.inputKind === "queriesOnly") {
    return { queries };
  }

  return {
    profileScraperMode: DEFAULT_PROFILE_MODE,
    queries,
  };
}

function normalizeActorProfile(item: unknown, actor: ApifyActorOption): LinkedInProfile {
  if (actor.outputKind === "unseenuserLinkedInProfile") {
    return normalizeUnseenUserLinkedInProfile(item);
  }

  return item as LinkedInProfile;
}

function normalizeUnseenUserLinkedInProfile(item: unknown): LinkedInProfile {
  const raw = asRecord(item);
  const profileUrl = asString(raw.profileUrl) ?? asString(raw.linkedinUrl);
  const location = normalizeLocation(raw.location);
  const experience = asArray(raw.experience).map(normalizeExperienceItem);
  const education = asArray(raw.education).map(normalizeEducationItem);
  const skills = normalizeSkills(raw.skills);
  const currentPosition = asArray(raw.currentPosition).length
    ? asArray(raw.currentPosition).map(normalizeExperienceItem)
    : experience.filter((item) => {
        const text = asString(item.endDate && "text" in item.endDate ? item.endDate.text : null);
        return !item.endDate || text?.toLowerCase() === "present";
      });
  const profileTopEducation = asArray(raw.profileTopEducation).length
    ? asArray(raw.profileTopEducation).map(normalizeEducationItem)
    : education.slice(0, 1);
  const photo = normalizeImageAsset(raw.profilePicture) ?? normalizeImageAsset(raw.photo);

  return {
    ...(raw as LinkedInProfile),
    id: asString(raw.id),
    publicIdentifier: asString(raw.publicIdentifier),
    linkedinUrl: profileUrl,
    profileUrl,
    firstName: asString(raw.firstName),
    lastName: asString(raw.lastName),
    headline: asString(raw.headline),
    location,
    about: asString(raw.about),
    connectionsCount: asNumber(raw.connectionsCount),
    followerCount: asNumber(raw.followerCount),
    experience,
    education,
    skills,
    certifications: asArray(raw.certifications) as CertificationItem[],
    languages: asArray(raw.languages),
    projects: asArray(raw.projects),
    publications: asArray(raw.publications),
    websites: asArray(raw.websites),
    currentPosition,
    profileTopEducation,
    profilePicture: photo,
    photo,
    coverPicture: normalizeImageAsset(raw.coverPicture),
    originalQuery: normalizeOriginalQuery(raw.originalQuery, profileUrl),
  };
}

function collectProfileLookupKeys(profile: LinkedInProfile) {
  const keys = [
    safeNormalizeLinkedInUrl(profile.originalQuery?.query),
    safeNormalizeLinkedInUrl(profile.linkedinUrl),
    safeNormalizeLinkedInUrl(profile.profileUrl),
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

function normalizeLocation(value: unknown): LinkedInProfile["location"] {
  if (typeof value === "string") {
    return {
      linkedinText: value,
      parsed: { text: value },
    };
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as LinkedInProfile["location"];
  return record;
}

function normalizeExperienceItem(value: unknown) {
  const record = asRecord(value);

  return {
    ...record,
    position: asString(record.position) ?? asString(record.title),
    companyName: asString(record.companyName),
    location: asString(record.location),
    employmentType: asString(record.employmentType),
    workplaceType: asString(record.workplaceType),
    companyLinkedinUrl: asString(record.companyLinkedinUrl),
    companyId: asString(record.companyId),
    companyUniversalName: asString(record.companyUniversalName),
    duration: asString(record.duration),
    description: asString(record.description),
    skills: asArray(record.skills).flatMap((skill) => {
      if (typeof skill === "string") return [skill];
      const name = asString(asRecord(skill).name);
      return name ? [name] : [];
    }),
    startDate: normalizeDatePart(record.startDate),
    endDate: normalizeDatePart(record.endDate),
    companyLogo: normalizeImageAsset(record.companyLogo),
  };
}

function normalizeEducationItem(value: unknown) {
  const record = asRecord(value);

  return {
    ...record,
    schoolName: asString(record.schoolName),
    schoolLinkedinUrl: asString(record.schoolLinkedinUrl),
    schoolId: asString(record.schoolId),
    degree: asString(record.degree) ?? asString(record.degreeName),
    fieldOfStudy: asString(record.fieldOfStudy),
    skills: asArray(record.skills).flatMap((skill) => {
      if (typeof skill === "string") return [skill];
      const name = asString(asRecord(skill).name);
      return name ? [name] : [];
    }),
    startDate: normalizeDatePart(record.startDate),
    endDate: normalizeDatePart(record.endDate),
    period: asString(record.period),
    schoolLogo: normalizeImageAsset(record.schoolLogo),
  };
}

function normalizeSkills(value: unknown) {
  return asArray(value).flatMap((skill) => {
    if (typeof skill === "string") {
      return [{ name: skill }];
    }

    const record = asRecord(skill);
    const name = asString(record.name) ?? asString(record.skill) ?? asString(record.title);
    return name ? [{ ...record, name }] : [];
  });
}

function normalizeDatePart(value: unknown): (DateRangePart & { text?: string }) | undefined {
  if (typeof value === "string") {
    const match = /^(\d{4})(?:-(\d{1,2}))?/.exec(value);
    return {
      ...(match?.[1] ? { year: Number(match[1]) } : {}),
      ...(match?.[2] ? { month: Number(match[2]) } : {}),
      text: value,
    };
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as DateRangePart & { text?: string };
}

function normalizeImageAsset(value: unknown): ImageAsset | null {
  if (typeof value === "string") {
    return value ? { url: value } : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return value as ImageAsset;
}

function normalizeOriginalQuery(value: unknown, profileUrl?: string): LinkedInProfile["originalQuery"] {
  const record = asRecord(value);
  const query = asString(record.query) ?? profileUrl;
  return query ? { ...record, query } : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
