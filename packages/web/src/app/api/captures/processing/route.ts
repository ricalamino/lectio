import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { inboxTabs } from "@lectio/core/db/schema";
import {
  getCaptureStatusCounts,
  getTagCaptureCounts,
} from "@/lib/capture-status-counts";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = db();
  const tabs = await database
    .select({ tag: inboxTabs.tag })
    .from(inboxTabs)
    .orderBy(asc(inboxTabs.position), asc(inboxTabs.createdAt));

  const tagList = tabs.map((t) => t.tag);
  const [counts, tagCounts] = await Promise.all([
    getCaptureStatusCounts(database),
    getTagCaptureCounts(database, tagList),
  ]);

  return NextResponse.json({ ...counts, tagCounts });
}
