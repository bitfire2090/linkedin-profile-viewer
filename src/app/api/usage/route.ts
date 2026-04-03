import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { buildUsageDashboard } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireApprovedUser();
    const { searchParams } = new URL(request.url);
    const dashboard = await buildUsageDashboard(user._id?.toString() ?? "", {
      preset: searchParams.get("preset"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });
    return NextResponse.json(dashboard);
  } catch (error) {
    return handleRouteError(error, "Usage API error");
  }
}
