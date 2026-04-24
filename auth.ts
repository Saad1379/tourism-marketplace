import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { createClient as createSupabaseBrowserClient } from "@supabase/supabase-js";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "tourist" | "guide" | "admin" | null;
      supabaseAccessToken?: string | null;
      supabaseRefreshToken?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: "tourist" | "guide" | "admin" | null;
    supabaseAccessToken?: string | null;
    supabaseRefreshToken?: string | null;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Supabase",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const supabase = createSupabaseBrowserClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          {
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.user || !data.session) {
          return null;
        }

        if (!data.user.email_confirmed_at) {
          throw new Error("EMAIL_NOT_CONFIRMED");
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, guide_approval_status")
          .eq("id", data.user.id)
          .single();

        const role =
          (profile?.role as "tourist" | "guide" | "admin" | null) ?? "tourist";

        if (role === "guide" && profile?.guide_approval_status === "pending") {
          throw new Error("GUIDE_PENDING");
        }
        if (role === "guide" && profile?.guide_approval_status === "rejected") {
          throw new Error("GUIDE_REJECTED");
        }

        return {
          id: data.user.id,
          email: data.user.email ?? email,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ?? null,
          image:
            (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
          role,
          supabaseAccessToken: data.session.access_token,
          supabaseRefreshToken: data.session.refresh_token,
        };
      },
    }),
    // Bridge for flows that already produced a valid Supabase session (e.g.
    // the email-confirmation callback or Supabase's Google OAuth). The
    // /auth/complete client page reads the Supabase session from cookies and
    // POSTs the access token here so NextAuth can mint its own session. That
    // way Google signups — which we delegate to Supabase — still end up with
    // a real NextAuth session instead of a half-authenticated mixed state.
    Credentials({
      id: "supabase-session",
      name: "Supabase Session",
      credentials: {
        access_token: { label: "Access Token", type: "text" },
        refresh_token: { label: "Refresh Token", type: "text" },
      },
      async authorize(credentials) {
        const accessToken =
          typeof credentials?.access_token === "string"
            ? credentials.access_token
            : ""
        const refreshToken =
          typeof credentials?.refresh_token === "string"
            ? credentials.refresh_token
            : ""
        if (!accessToken) return null

        const supabase = createSupabaseBrowserClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } },
        )

        const { data: userData, error: userError } =
          await supabase.auth.getUser(accessToken)
        if (userError || !userData.user) return null
        const user = userData.user

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, guide_approval_status, onboarding_completed")
          .eq("id", user.id)
          .single()

        const role =
          (profile?.role as "tourist" | "guide" | "admin" | null) ?? "tourist"

        // Only block when the guide has already submitted onboarding — i.e.
        // the review queue is actually active for them. A fresh OAuth signup
        // has status NULL and must flow through to /become-guide.
        if (
          role === "guide" &&
          profile?.guide_approval_status === "pending" &&
          profile?.onboarding_completed === true
        ) {
          throw new Error("GUIDE_PENDING")
        }
        if (role === "guide" && profile?.guide_approval_status === "rejected") {
          throw new Error("GUIDE_REJECTED")
        }

        return {
          id: user.id,
          email: user.email ?? "",
          name:
            (user.user_metadata?.full_name as string | undefined) ?? null,
          image:
            (user.user_metadata?.avatar_url as string | undefined) ?? null,
          role,
          supabaseAccessToken: accessToken,
          supabaseRefreshToken: refreshToken || null,
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "tourist";
        token.supabaseAccessToken = user.supabaseAccessToken ?? null;
        token.supabaseRefreshToken = user.supabaseRefreshToken ?? null;
      }
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.role =
          (token.role as "tourist" | "guide" | "admin" | null) ?? "tourist";
        session.user.supabaseAccessToken =
          (token.supabaseAccessToken as string | null) ?? null;
        session.user.supabaseRefreshToken =
          (token.supabaseRefreshToken as string | null) ?? null;
      }
      return session;
    },
  },
});
