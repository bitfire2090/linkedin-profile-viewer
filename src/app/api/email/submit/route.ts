import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { getRocketReachCollection } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { emailLookupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireApprovedUser();
    const payload = await request.json();
    const { email } = emailLookupSchema.parse(payload);
    const collection = await getRocketReachCollection();
    const now = new Date();

    const existing = await collection.findOne({ emails: { $in: [email] } });

    if (existing) {
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: { updatedAt: now },
          $addToSet: { emails: email },
        },
      );

      const refreshed = await collection.findOne({ _id: existing._id });

      return NextResponse.json({
        email,
        existed: true,
        record: refreshed
          ? {
              id: refreshed._id?.toString() ?? "",
              profileId: refreshed.profileId ?? null,
              emails: refreshed.emails ?? [email],
              createdAt: (refreshed.createdAt ?? now).toISOString(),
              updatedAt: (refreshed.updatedAt ?? refreshed.createdAt ?? now).toISOString(),
            }
          : null,
      });
    }

    const result = await collection.insertOne({
      profileId: null,
      emails: [email],
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      email,
      existed: false,
      record: {
        id: result.insertedId.toString(),
        profileId: null,
        emails: [email],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    return handleRouteError(error, "Email submit API error");
  }
}
