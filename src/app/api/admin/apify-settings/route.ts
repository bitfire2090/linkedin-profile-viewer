import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { getApifyActorSettings, updateApifyActorSettings } from "@/lib/apify-settings";
import { handleRouteError } from "@/lib/http";
import { apifyActorUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const settings = await getApifyActorSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error, "Admin Apify settings API error");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminUser();
    const payload = await request.json();
    const input = apifyActorUpdateSchema.parse(payload);
    const settings = await updateApifyActorSettings(input.actorId);

    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error, "Admin Apify settings update API error");
  }
}
