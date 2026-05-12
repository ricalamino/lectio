import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const rows = await db().select().from(captures).orderBy(desc(captures.capturedAt)).limit(50);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing yet. Start capturing.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm">
              <Link href={`/inbox/${c.id}`} className="block hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.kind}</span>
                  <span className="text-muted-foreground text-xs">{c.status}</span>
                </div>
                {c.rawText ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{c.rawText}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
