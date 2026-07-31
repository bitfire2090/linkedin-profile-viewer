import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentSessionUser, toUserDto } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sessionUser = await getCurrentSessionUser();

    if (!sessionUser) {
      const response = NextResponse.json(
        {
          error: "Not authenticated.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 },
      );
      clearSessionCookie(request, response);
      return response;
    }

    return NextResponse.json({
      user: toUserDto(sessionUser.user),
    });
  } catch (error) {
    return handleRouteError(error, "Session API error");
  }
}
