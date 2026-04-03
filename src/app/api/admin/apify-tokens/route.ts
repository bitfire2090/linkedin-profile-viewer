import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { createApifyToken, listApifyTokensWithUsage } from "@/lib/apify-tokens";
import { handleRouteError } from "@/lib/http";
import { apifyTokenCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const tokens = await listApifyTokensWithUsage();
    return NextResponse.json({ tokens });
  } catch (error) {
    return handleRouteError(error, "Admin Apify tokens API error");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const payload = await request.json();
    const input = apifyTokenCreateSchema.parse(payload);
    await createApifyToken(input);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Admin Apify token create API error");
  }
}
