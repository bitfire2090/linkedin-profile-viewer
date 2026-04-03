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
    const record = await collection.findOne({ emails: { $in: [email] } });

    return NextResponse.json({
      email,
      exists: Boolean(record),
      record: record
        ? {
            id: record._id?.toString() ?? "",
            profileId: record.profileId ?? null,
            emails: record.emails ?? [email],
            createdAt: (record.createdAt ?? new Date()).toISOString(),
            updatedAt: (record.updatedAt ?? record.createdAt ?? new Date()).toISOString(),
          }
        : null,
    });
  } catch (error) {
    return handleRouteError(error, "Email lookup API error");
  }
}
