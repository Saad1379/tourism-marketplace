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
