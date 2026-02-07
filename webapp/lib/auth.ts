/**
 * Auth.js v5 (NextAuth) configuration.
 *
 * Configures:
 * - Drizzle adapter for database session storage
 * - Credentials provider for email/password authentication
 * - 7-day database sessions with sliding window refresh
 *
 * The authorize logic is in auth-utils.ts for testability.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/drizzle/schema";
import {
  authorizeCredentials,
  SESSION_MAX_AGE,
} from "@/lib/auth-utils";

// Re-export from auth-utils for consumers
export { emailSchema, SESSION_MAX_AGE, authorizeCredentials } from "@/lib/auth-utils";
export type { CredentialsInput, AuthorizeResult } from "@/lib/auth-utils";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: 24 * 60 * 60, // Update session every 24 hours (sliding window)
  },
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, persist user id and email into the JWT
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      // Populate session from JWT token
      if (session.user) {
        session.user.id = String(token.id);
        session.user.email = String(token.email);
      }
      return session;
    },
  },
  trustHost: true,
});

// Export type for session user with id
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
    };
  }
}
