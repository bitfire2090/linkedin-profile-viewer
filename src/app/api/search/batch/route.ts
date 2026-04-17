import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { searchLinkedInUrls } from "@/lib/linkedin-search";
import { batchSearchBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await requireApprovedUser();
    const payload = await request.json();
    const rawUrls: string[] = Array.isArray(payload?.urls)
      ? payload.urls.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const trimmedUrls = rawUrls.map((value: string) => value.trim()).filter(Boolean);
    const { urls } = batchSearchBodySchema.parse({ urls: trimmedUrls });
    const items = await searchLinkedInUrls(urls, user);

    return NextResponse.json({
      items,
      total: items.length,
      existsCount: items.filter((item) => item.status === "exists").length,
      newlyFoundCount: items.filter((item) => item.status === "newly_found").length,
      errorCount: items.filter((item) => item.status === "error").length,
    });
  } catch (error) {
    return handleRouteError(error, "Batch search API error");
  }
}
