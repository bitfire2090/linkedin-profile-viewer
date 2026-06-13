import { ObjectId } from "mongodb";
import { LinkedInProfile } from "@/types/linkedin";

export type UserRole = "admin" | "user";

export interface UserRecord {
  _id?: ObjectId;
  username: string;
  passwordHash: string;
  role: UserRole;
  approved: boolean;
  approvedAt?: Date | null;
  approvedByUserId?: ObjectId | null;
  disabledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
}

export interface SessionRecord {
  _id?: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}

export interface SearchRecord {
  _id?: ObjectId;
  url: string;
  profile: LinkedInProfile;
  createdAt: Date;
  updatedAt: Date;
  source?: "cache" | "fresh";
}

export interface SearchEventRecord {
  _id?: ObjectId;
  userId: ObjectId;
  username: string;
  url: string;
  source: "cache" | "fresh";
  searchRecordId?: ObjectId | null;
  createdAt: Date;
}

export interface ApifyTokenRecord {
  _id?: ObjectId;
  token: string;
  metadata: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSettingsRecord {
  _id?: ObjectId;
  key: "global";
  apifyActorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RocketReachRecord {
  _id?: ObjectId;
  profileId?: number | null;
  emails: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type SearchRecordDTO = Omit<SearchRecord, "_id" | "createdAt" | "updatedAt"> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
