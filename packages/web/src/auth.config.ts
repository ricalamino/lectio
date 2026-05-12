import type { NextAuthConfig } from "next-auth";

// Edge-safe pieces of the auth config. The middleware imports this; node-only
// code (Credentials provider, bcrypt-like compare) lives in ./auth.ts and is
// not loaded at the edge.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const pathname = request.nextUrl.pathname;
      if (pathname === "/login") return true;
      return isLoggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
