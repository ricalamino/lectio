import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Lectio</h1>
        <p className="mt-2 text-muted-foreground">
          Capture-first knowledge. Self-hosted. Bring your own model.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/capture">New capture</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/inbox">Open inbox</Link>
        </Button>
      </div>
    </div>
  );
}
