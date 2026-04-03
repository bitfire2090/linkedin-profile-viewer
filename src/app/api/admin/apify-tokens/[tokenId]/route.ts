import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { deleteApifyToken, updateApifyToken } from "@/lib/apify-tokens";
import { handleRouteError } from "@/lib/http";
import { apifyTokenUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    await requireAdminUser();
    const payload = await request.json();
    const input = apifyTokenUpdateSchema.parse(payload);
    const { tokenId } = await params;

    await updateApifyToken(tokenId, input);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Admin Apify token update API error");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    await requireAdminUser();
    const { tokenId } = await params;
    await deleteApifyToken(tokenId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Admin Apify token delete API error");
  }
}
