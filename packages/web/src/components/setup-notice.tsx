"use client";

import { useEffect, useState } from "react";

interface SetupStatus {
  ready: boolean;
  issues: string[];
}

export function SetupNotice() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/setup-status")
      .then((r) => r.json() as Promise<SetupStatus>)
      .then(setStatus)
      .catch(() => null);
  }, []);

  if (!status || status.ready || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-950/90 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-amber-400 text-lg leading-none">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-300">Setup incomplete</p>
            <ul className="mt-1 space-y-0.5">
              {status.issues.map((issue, i) => (
                <li key={i} className="text-xs text-amber-200/80 break-words">
                  {issue}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-200/60">
              Edit <code className="font-mono">.env</code> and restart the app.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-amber-400/60 hover:text-amber-300 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
