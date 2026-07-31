import { NextResponse } from "next/server";
import { clearSessionCookie, deleteCurrentSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await deleteCurrentSession();
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(request, response);
    return response;
  } catch (error) {
    return handleRouteError(error, "Logout API error");
  }
}
