import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCaptureStatusCounts } from "@/lib/capture-status-counts";

export const dynamic = "force-dynamic";

export async function GET() {
  const counts = await getCaptureStatusCounts(db());
  return NextResponse.json(counts);
}
