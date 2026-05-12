// Route group with no sidebar/chrome. The login page (and any future auth
// pages) renders inside this minimal frame.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-background text-foreground">{children}</div>;
}
