import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";
import { CaptureDetail } from "@/components/capture-detail";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function CaptureDetailPage({ params }: Props) {
  const { id } = params;
  const [capture] = await db()
    .select({ id: captures.id })
    .from(captures)
    .where(eq(captures.id, id))
    .limit(1);
  if (!capture) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <CaptureDetail id={id} variant="page" />
    </div>
  );
}
