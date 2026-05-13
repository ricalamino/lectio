"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Swallow — SW registration must never block app usage.
    });

    // Listen for Background Sync flush messages from the service worker.
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "FLUSH_OFFLINE_QUEUE") {
        window.dispatchEvent(new CustomEvent("lectio:flush-offline-queue"));
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  return null;
}
