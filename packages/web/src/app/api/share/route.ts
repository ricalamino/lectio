import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";
import { publishEnrich } from "@/lib/queue";

// PWA share target. Receives whatever the OS sends — title/text/url and
// optionally a file — and turns it into a capture. The shape mirrors
// manifest.webmanifest's share_target params.
export async function POST(request: Request) {
  const form = await request.formData();
  const title = form.get("title");
  const text = form.get("text");
  const url = form.get("url");
  const file = form.get("file");

  const rawText = [title, text].filter(Boolean).join("\n\n").trim() || null;
  const sourceUrl = typeof url === "string" && url.length > 0 ? url : null;

  let kind: "text" | "link" | "image" | "file" = "text";
  if (file instanceof File && file.size > 0) {
    kind = file.type.startsWith("image/") ? "image" : "file";
  } else if (sourceUrl) {
    kind = "link";
  }

  const [row] = await db()
    .insert(captures)
    .values({
      kind,
      rawText,
      sourceUrl,
      // MinIO upload of `file` belongs in a follow-up — for now we record the
      // capture so the user sees it in the inbox immediately.
    })
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
  await publishEnrich({ captureId: row.id });
  return NextResponse.redirect(new URL("/inbox", request.url), 303);
}
