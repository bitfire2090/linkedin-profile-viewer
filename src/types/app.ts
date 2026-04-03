export type UserRole = "admin" | "user";
export type UserStatus = "approved" | "pending" | "disabled";
export type UsagePreset = "today" | "last3days" | "lastWeek" | "lastMonth" | "total" | "custom";

export interface UserDTO {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  approved: boolean;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  lastLoginAt: string | null;
}

export interface AuthSessionDTO {
  user: UserDTO;
}

export interface AuthMutationResponse {
  user: UserDTO;
  message: string;
  sessionCreated: boolean;
  requiresApproval: boolean;
}

export interface UsageTotalsDTO {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  disabledUsers: number;
  activeSessions: number;
  cachedProfiles: number;
  totalSearches: number;
  freshSearches: number;
  cachedSearches: number;
}

export interface UsageUserSummaryDTO extends UserDTO {
  totalSearches: number;
  freshSearches: number;
  cachedSearches: number;
  lastSearchAt: string | null;
}

export interface RecentSearchActivityDTO {
  id: string;
  username: string;
  url: string;
  source: "cache" | "fresh";
  createdAt: string;
}

export interface UsageFilterDTO {
  preset: UsagePreset;
  label: string;
  startDate: string | null;
  endDate: string | null;
}

export interface UsageDashboardDTO {
  filter: UsageFilterDTO;
  totals: UsageTotalsDTO;
  currentUser: UsageUserSummaryDTO;
  users: UsageUserSummaryDTO[];
  recentSearches: RecentSearchActivityDTO[];
}

export interface ApifyTokenDTO {
  id: string;
  metadata: string;
  tokenPreview: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  monthlyUsageUsd: number | null;
  maxMonthlyUsageUsd: number | null;
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  usageFetchedAt: string | null;
  usageError: string | null;
}
