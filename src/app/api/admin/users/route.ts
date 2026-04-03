import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { buildUsageDashboard } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireAdminUser();
    const dashboard = await buildUsageDashboard(user._id?.toString() ?? "");
    return NextResponse.json({
      users: dashboard.users,
    });
  } catch (error) {
    return handleRouteError(error, "Admin users API error");
  }
}
