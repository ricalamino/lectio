"use client";

import { usePathname } from "next/navigation";

interface InboxDetailPaneProps {
  children: React.ReactNode;
}

// Wraps the @detail parallel slot. Parallel routes in Next.js don't always
// reset the slot to default.tsx on soft navigation back to the parent — the
// last intercepted page can stay mounted. We use the current pathname to
// hide the pane whenever we're not actually viewing a capture.
export function InboxDetailPane({ children }: InboxDetailPaneProps) {
  const pathname = usePathname();
  const open = pathname?.startsWith("/inbox/") ?? false;
  if (!open) return null;
  return (
    <aside className="hidden min-w-0 lg:block">
      <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}

export function InboxGridShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const open = pathname?.startsWith("/inbox/") ?? false;
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div
        className={
          open
            ? "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]"
            : "grid grid-cols-1 gap-6"
        }
      >
        {children}
      </div>
    </div>
  );
}
