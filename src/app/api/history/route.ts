import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { getSearchCollection } from "@/lib/db";
import { handleRouteError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireApprovedUser();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      20,
      Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "10", 10) || 10),
    );
    const skip = (page - 1) * pageSize;
 
    const collection = await getSearchCollection();

    const [items, total] = await Promise.all([
      collection.find().sort({ updatedAt: -1 }).skip(skip).limit(pageSize).toArray(),
      collection.countDocuments(),
    ]);

    return NextResponse.json({
      items: items.map((item) => ({
        id: item._id?.toString() ?? "",
        url: item.url,
        profile: item.profile,
        source: item.source ?? "cache",
        createdAt: (item.createdAt ?? new Date()).toISOString(),
        updatedAt: (item.updatedAt ?? item.createdAt ?? new Date()).toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return handleRouteError(error, "History API error");
  }
}
