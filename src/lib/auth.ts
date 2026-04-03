import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCollection, getUserCollection } from "./db";
import { UserRecord } from "./models";
import { normalizeUsername } from "./validation";
import { UserDTO, UserStatus } from "@/types/app";

const scryptAsync = promisify(scrypt);
const SESSION_COOKIE_NAME = "linkedin_profile_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 401, code = "AUTH_ERROR") {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

export function getUserStatus(user: Pick<UserRecord, "approved" | "disabledAt">): UserStatus {
  if (user.disabledAt) {
    return "disabled";
  }
  return user.approved ? "approved" : "pending";
}

export function toUserDto(user: UserRecord): UserDTO {
  return {
    id: user._id?.toString() ?? "",
    username: user.username,
    role: user.role,
    status: getUserStatus(user),
    approved: user.approved,
    disabled: Boolean(user.disabledAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    approvedAt: user.approvedAt ? user.approvedAt.toISOString() : null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

export async function ensureAdminAccount() {
  const configuredUsername = process.env.APP_ADMIN_USERNAME?.trim();
  const configuredPassword = process.env.APP_ADMIN_PASSWORD;

  if (!configuredUsername || !configuredPassword) {
    return;
  }

  const username = normalizeUsername(configuredUsername);
  const users = await getUserCollection();
  const existing = await users.findOne({ username });

  if (existing) {
    return;
  }

  const now = new Date();

  await users.insertOne({
    username,
    passwordHash: await hashPassword(configuredPassword),
    role: "admin",
    approved: true,
    approvedAt: now,
    approvedByUserId: null,
    disabledAt: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });
}

export async function registerUser(username: string, password: string) {
  await ensureAdminAccount();

  const users = await getUserCollection();
  const now = new Date();
  const adminCount = await users.countDocuments({
    role: "admin",
    approved: true,
    disabledAt: null,
  });
  const shouldBootstrapAdmin = adminCount === 0;

  try {
    const result = await users.insertOne({
      username,
      passwordHash: await hashPassword(password),
      role: shouldBootstrapAdmin ? "admin" : "user",
      approved: shouldBootstrapAdmin,
      approvedAt: shouldBootstrapAdmin ? now : null,
      approvedByUserId: null,
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });

    const user = await users.findOne({ _id: result.insertedId });
    if (!user) {
      throw new Error("Unable to load newly created user.");
    }

    return user;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AuthError("That username already exists.", 409, "USERNAME_EXISTS");
    }
    throw error;
  }
}

export async function authenticateUser(username: string, password: string) {
  await ensureAdminAccount();

  const users = await getUserCollection();
  const user = await users.findOne({ username });

  if (!user) {
    throw new AuthError("Invalid username or password.", 401, "INVALID_CREDENTIALS");
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AuthError("Invalid username or password.", 401, "INVALID_CREDENTIALS");
  }

  if (user.disabledAt) {
    throw new AuthError("Your account has been disabled by an admin.", 403, "ACCOUNT_DISABLED");
  }

  if (!user.approved) {
    throw new AuthError("Your account is waiting for admin approval.", 403, "ACCOUNT_PENDING");
  }

  return user;
}

export async function createSessionForUser(user: UserRecord) {
  if (!user._id) {
    throw new Error("Cannot create a session for a user without an id.");
  }

  const sessions = await getSessionCollection();
  const users = await getUserCollection();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const token = randomBytes(32).toString("hex");

  await sessions.insertOne({
    userId: user._id,
    tokenHash: hashSessionToken(token),
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    expiresAt,
  });

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        lastLoginAt: now,
        updatedAt: now,
      },
    },
  );

  return { token, expiresAt };
}

export async function deleteCurrentSession() {
  const token = await getSessionToken();
  if (!token) {
    return;
  }

  const sessions = await getSessionCollection();
  await sessions.deleteOne({ tokenHash: hashSessionToken(token) });
}

export async function revokeUserSessions(userId: ObjectId) {
  const sessions = await getSessionCollection();
  await sessions.deleteMany({ userId });
}

export async function getCurrentSessionUser() {
  await ensureAdminAccount();

  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const sessions = await getSessionCollection();
  const now = new Date();
  const session = await sessions.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: now },
  });

  if (!session) {
    return null;
  }

  const users = await getUserCollection();
  const user = await users.findOne({ _id: session.userId });

  if (!user || user.disabledAt || !user.approved) {
    await sessions.deleteMany({ userId: session.userId });
    return null;
  }

  await sessions.updateOne(
    { _id: session._id },
    {
      $set: {
        updatedAt: now,
        lastUsedAt: now,
      },
    },
  );

  return { user, session };
}

export async function requireApprovedUser() {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    throw new AuthError("You must log in with an approved account.", 401, "AUTH_REQUIRED");
  }
  return sessionUser;
}

export async function requireAdminUser() {
  const sessionUser = await requireApprovedUser();
  if (sessionUser.user.role !== "admin") {
    throw new AuthError("Admin access is required.", 403, "ADMIN_REQUIRED");
  }
  return sessionUser;
}

export function applySessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) {
    return false;
  }

  const storedKey = Buffer.from(key, "hex");
  const candidateKey = (await scryptAsync(password, salt, storedKey.length)) as Buffer;

  if (candidateKey.length !== storedKey.length) {
    return false;
  }

  return timingSafeEqual(candidateKey, storedKey);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
