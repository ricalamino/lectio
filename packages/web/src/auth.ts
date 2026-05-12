import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const expected = process.env.ADMIN_PASSWORD;
        if (!expected) {
          console.error("[auth] ADMIN_PASSWORD is not set; refusing all logins");
          return null;
        }
        if (parsed.data.username !== "admin") return null;
        if (!constantTimeEqual(parsed.data.password, expected)) return null;
        return { id: "admin", name: "admin" };
      },
    }),
  ],
});
