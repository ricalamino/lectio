import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { captures } from "@lectio/core/db/schema";
import { getCaptureObjectSignedUrl, isObjectStorageConfigured } from "@/lib/storage";

export async function GET(
  _request: Request,
  ctx: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = ctx.params;
  const cfg = env();
  if (!isObjectStorageConfigured(cfg)) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const [row] = await db()
    .select({ mediaKey: captures.mediaKey })
    .from(captures)
    .where(eq(captures.id, id));

  if (!row?.mediaKey) {
    return NextResponse.json({ error: "No media for this capture" }, { status: 404 });
  }

  const signedUrl = await getCaptureObjectSignedUrl(cfg, row.mediaKey);
  return NextResponse.redirect(signedUrl, 302);
}
