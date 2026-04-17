import { z } from "zod";

const usernamePattern = /^[a-zA-Z0-9._-]+$/;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be 32 characters or fewer")
  .regex(usernamePattern, "Username can only include letters, numbers, dots, dashes, and underscores")
  .transform((value) => normalizeUsername(value));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer");

export const searchBodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "LinkedIn URL is required")
    .min(5, "URL is too short")
    .transform((value) => normalizeLinkedInUrl(value)),
});

export const batchSearchBodySchema = z.object({
  urls: z
    .array(z.string())
    .min(1, "At least one LinkedIn URL is required")
    .max(100, "You can check up to 100 LinkedIn URLs at a time"),
});

export const emailLookupSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email format")
    .transform((value) => normalizeEmail(value)),
});

export const registerBodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const loginBodySchema = registerBodySchema;

export const adminUserActionSchema = z.object({
  action: z.enum(["approve", "disable", "enable"]),
});

const apifyTokenSecretSchema = z
  .string()
  .trim()
  .min(10, "Apify token is required")
  .max(512, "Apify token is too long");

const apifyTokenMetadataSchema = z
  .string()
  .trim()
  .min(1, "Metadata is required")
  .max(120, "Metadata must be 120 characters or fewer");

const optionalApifyTokenSecretSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  apifyTokenSecretSchema.optional(),
);

export const apifyTokenCreateSchema = z.object({
  token: apifyTokenSecretSchema,
  metadata: apifyTokenMetadataSchema,
  activate: z.boolean().optional().default(false),
});

export const apifyTokenUpdateSchema = z
  .object({
    token: optionalApifyTokenSecretSchema,
    metadata: apifyTokenMetadataSchema.optional(),
    activate: z.boolean().optional(),
  })
  .refine(
    (value) => value.token !== undefined || value.metadata !== undefined || value.activate !== undefined,
    "At least one token field must be updated.",
  );

export function normalizeLinkedInUrl(raw: string) {
  const trimmed = raw.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    try {
      parsed = new URL(`https://${trimmed}`);
    } catch {
      throw new Error("Invalid URL format");
    }
  }

  if (!/linkedin\.com$/i.test(parsed.hostname) && !/\.linkedin\.com$/i.test(parsed.hostname)) {
    throw new Error("Please provide a valid linkedin.com URL");
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");

  return parsed.toString();
}

export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}
