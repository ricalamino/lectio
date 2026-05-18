"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface InboxRowProps {
  captureId: string;
  children: React.ReactNode;
}

export function InboxRow({ captureId, children }: InboxRowProps) {
  const pathname = usePathname();
  const active = pathname === `/inbox/${captureId}`;
  return (
    <Link
      href={`/inbox/${captureId}`}
      className={cn(
        "block px-4 py-3 transition-colors hover:bg-muted/40",
        active && "bg-muted/60",
      )}
    >
      {children}
    </Link>
  );
}
