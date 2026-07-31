import { NextResponse } from "next/server";
import { applySessionCookie, authenticateUser, createSessionForUser, toUserDto } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { loginBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { username, password } = loginBodySchema.parse(payload);
    const user = await authenticateUser(username, password);
    const session = await createSessionForUser(user);
    const response = NextResponse.json({
      user: toUserDto(user),
      message: "Signed in successfully.",
      sessionCreated: true,
      requiresApproval: false,
    });

    applySessionCookie(request, response, session.token, session.expiresAt);

    return response;
  } catch (error) {
    return handleRouteError(error, "Login API error");
  }
}
