import type { Metadata, Viewport } from "next";
import { Sidebar } from "@/components/sidebar";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { AuthSessionProvider } from "@/components/session-provider";
import { EnrichmentProgress } from "@/components/enrichment-progress";
import { SetupNotice } from "@/components/setup-notice";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lectio",
  description: "Your second brain. Self-hosted. Bring your own model.",
  manifest: "/manifest.webmanifest",
  applicationName: "Lectio",
  appleWebApp: { capable: true, title: "Lectio", statusBarStyle: "black-translucent" },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <AuthSessionProvider>
          <Sidebar />
          <main className="md:pl-64">
            <div className="mx-auto max-w-3xl px-4 pt-16 pb-12 md:pt-8">{children}</div>
          </main>
          <EnrichmentProgress />
          <SetupNotice />
          <ServiceWorkerRegister />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
