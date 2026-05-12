import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// next-auth's edge-safe middleware. The `authorized` callback in auth.config
// is what gates each request — anything but /login requires a session.
export default NextAuth(authConfig).auth;

export const config = {
  // Skip static assets and the Next internals. /api/auth is allowed through
  // so the credentials POST works; the `authorized` callback handles the
  // rest (including other /api/* routes).
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|icons/).*)",
  ],
};
