export interface LinkedInProfile {
  id?: string;
  publicIdentifier?: string;
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  openToWork?: boolean;
  hiring?: boolean;
  premium?: boolean;
  influencer?: boolean;
  memorialized?: boolean;
  location?: ProfileLocation;
  objectUrn?: string;
  registeredAt?: string;
  topSkills?: unknown;
  connectionsCount?: number;
  followerCount?: number;
  verified?: boolean;
  about?: string;
  currentPosition?: PositionSummary[];
  profileTopEducation?: EducationSummary[];
  profileActions?: unknown[];
  profilePicture?: ImageAsset | null;
  coverPicture?: ImageAsset | null;
  photo?: ImageAsset | null;
  services?: unknown;
  experience?: ExperienceItem[];
  education?: EducationItem[];
  certifications?: CertificationItem[];
  skills?: SkillItem[];
  projects?: unknown[];
  volunteering?: unknown[];
  receivedRecommendations?: RecommendationItem[];
  moreProfiles?: RelatedProfile[];
  featured?: unknown;
  composeOptionType?: string;
  originalQuery?: { query?: string };
}

export interface ProfileLocation {
  linkedinText?: string;
  countryCode?: string;
  parsed?: {
    text?: string;
    countryCode?: string;
    regionCode?: string | null;
    country?: string;
    countryFull?: string;
    state?: string;
    city?: string;
  };
}

export interface PositionSummary {
  companyId?: string;
  companyLinkedinUrl?: string;
  companyName?: string;
  dateRange?: {
    start?: DateRangePart;
    end?: DateRangePart | null;
  };
}

export interface EducationSummary {
  schoolId?: string;
  companyId?: string;
  schoolLinkedinUrl?: string;
  schoolName?: string;
}

export interface ImageAsset {
  url?: string;
  sizes?: Array<{
    url?: string;
    width?: number;
    height?: number;
    expiresAt?: number;
  }>;
}

export interface ExperienceItem {
  position?: string;
  location?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  companyName?: string | null;
  companyLinkedinUrl?: string | null;
  companyId?: string | null;
  companyUniversalName?: string | null;
  duration?: string | null;
  description?: string | null;
  skills?: string[];
  startDate?: DateRangePart & { text?: string };
  endDate?: (DateRangePart & { text?: string }) | { text?: string } | null;
  companyLogo?: ImageAsset | null;
}

export interface EducationItem {
  schoolName?: string;
  schoolLinkedinUrl?: string;
  schoolId?: string;
  degree?: string;
  fieldOfStudy?: string;
  skills?: string[];
  startDate?: DateRangePart & { text?: string };
  endDate?: DateRangePart & { text?: string };
  period?: string;
  schoolLogo?: ImageAsset | null;
}

export interface CertificationItem {
  title?: string;
  issuedAt?: string;
  issuedBy?: string;
  issuedByLink?: string;
  issuedByLogo?: ImageAsset | null;
}

export interface SkillItem {
  name?: string;
  positions?: string[];
  endorsements?: string;
  assessments?: string;
}

export interface RecommendationItem {
  givenBy?: string;
  givenByHeadline?: string;
  givenAt?: string;
  givenByLink?: string;
  description?: string;
  givenByPicture?: ImageAsset | null;
}

export interface RelatedProfile {
  id?: string;
  firstName?: string;
  lastName?: string;
  publicIdentifier?: string;
  linkedinUrl?: string;
}

export interface DateRangePart {
  year?: number;
  month?: number | string | null;
  day?: number | null;
}

export interface SearchHistoryItem {
  id: string;
  url: string;
  createdAt: string;
  profile: LinkedInProfile;
  source?: "cache" | "fresh";
}
