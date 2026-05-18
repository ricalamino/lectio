"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, Calendar, FileDown, FolderInput, Inbox, LogOut, Menu, Plus, Search } from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/capture", label: "Capture", icon: Plus },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/search", label: "Search", icon: Search },
  { href: "/import", label: "Import", icon: FolderInput },
  { href: "/export", label: "Export", icon: FileDown },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/login") return null;

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 w-64 transform border-r border-border bg-background transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link
          href="/inbox"
          className="flex h-16 items-center gap-2 px-6 text-lg font-semibold tracking-tight"
        >
          <BookMarked className="h-5 w-5 text-primary" />
          <span>
            Lectio<span className="text-muted-foreground/60">.</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1 px-3">
          {items.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="absolute bottom-4 left-3 right-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      {open ? (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-10 bg-black/40 md:hidden"
        />
      ) : null}
    </>
  );
}
