import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { adminUserActionSchema } from "@/lib/validation";
import { getUserCollection } from "@/lib/db";
import { AuthError, requireAdminUser, revokeUserSessions, toUserDto } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { user: adminUser } = await requireAdminUser();
    const payload = await request.json();
    const { action } = adminUserActionSchema.parse(payload);
    const { userId } = await params;

    if (!ObjectId.isValid(userId)) {
      throw new AuthError("Invalid user id.", 400, "INVALID_USER_ID");
    }

    const users = await getUserCollection();
    const targetId = new ObjectId(userId);
    const target = await users.findOne({ _id: targetId });

    if (!target) {
      throw new AuthError("User not found.", 404, "USER_NOT_FOUND");
    }

    if (action === "disable" && targetId.equals(adminUser._id!)) {
      throw new AuthError("You cannot disable your own account.", 400, "SELF_DISABLE_BLOCKED");
    }

    if (action === "disable" && target.role === "admin") {
      const activeAdminCount = await users.countDocuments({
        role: "admin",
        approved: true,
        disabledAt: null,
      });

      if (activeAdminCount <= 1) {
        throw new AuthError("The last active admin cannot be disabled.", 400, "LAST_ADMIN_BLOCKED");
      }
    }

    const now = new Date();

    if (action === "approve") {
      await users.updateOne(
        { _id: targetId },
        {
          $set: {
            approved: true,
            approvedAt: now,
            approvedByUserId: adminUser._id ?? null,
            disabledAt: null,
            updatedAt: now,
          },
        },
      );
    }

    if (action === "disable") {
      await users.updateOne(
        { _id: targetId },
        {
          $set: {
            disabledAt: now,
            updatedAt: now,
          },
        },
      );
      await revokeUserSessions(targetId);
    }

    if (action === "enable") {
      await users.updateOne(
        { _id: targetId },
        {
          $set: {
            disabledAt: null,
            updatedAt: now,
          },
        },
      );
    }

    const updatedUser = await users.findOne({ _id: targetId });

    return NextResponse.json({
      ok: true,
      user: updatedUser ? toUserDto(updatedUser) : null,
    });
  } catch (error) {
    return handleRouteError(error, "Admin user mutation API error");
  }
}
