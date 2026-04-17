import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { searchLinkedInUrl } from "@/lib/linkedin-search";
import { searchBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await requireApprovedUser();
    const payload = await request.json();
    const { url } = searchBodySchema.parse(payload);
    const result = await searchLinkedInUrl(url, user);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Search API error");
  }
}
