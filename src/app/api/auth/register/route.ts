import { NextResponse } from "next/server";
import { applySessionCookie, createSessionForUser, registerUser, toUserDto } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { registerBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { username, password } = registerBodySchema.parse(payload);
    const user = await registerUser(username, password);
    const shouldCreateSession = user.approved && !user.disabledAt;
    const response = NextResponse.json({
      user: toUserDto(user),
      message: shouldCreateSession
        ? "Admin account created and signed in."
        : "Account created. Wait for admin approval before signing in.",
      sessionCreated: shouldCreateSession,
      requiresApproval: !user.approved,
    });

    if (shouldCreateSession) {
      const session = await createSessionForUser(user);
      applySessionCookie(request, response, session.token, session.expiresAt);
    }

    return response;
  } catch (error) {
    return handleRouteError(error, "Register API error");
  }
}
