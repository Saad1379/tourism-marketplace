"use client"

/**
 * Bridge page for flows that produced a Supabase session but still need a
 * NextAuth session (email-confirmation callback, Supabase Google OAuth).
 *
 * Flow:
 *   1. /auth/callback runs exchangeCodeForSession, sets Supabase cookies, and
 *      redirects here with ?next=<target>.
 *   2. This page reads the Supabase session on the client, posts the access
 *      token to the `supabase-session` NextAuth provider, which validates it
 *      via supabase.auth.getUser() and mints a NextAuth session.
 *   3. We forward to <target> (e.g. /become-guide for new guides).
 *
 * If the bridge fails we fall back to /login — at worst the user signs in
 * manually, at best they never see this page.
 */

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn as nextAuthSignIn } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

function AuthCompleteInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/profile"
  const hasRun = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const bridge = async () => {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData?.session

      if (!session?.access_token) {
        router.replace("/login?error=bridge_no_session")
        return
      }

      const result = await nextAuthSignIn("supabase-session", {
        access_token: session.access_token,
        refresh_token: session.refresh_token ?? "",
        redirect: false,
      })

      if (!result || result.error) {
        const reason = result?.error || "bridge_failed"
        // Preserve the Supabase session so the user can retry manual sign-in
        // with a password if they have one; don't sign them out here.
        if (reason === "GUIDE_PENDING") {
          router.replace("/login?guide_pending=1")
        } else if (reason === "GUIDE_REJECTED") {
          router.replace("/login?error=guide_rejected")
        } else {
          setError(reason)
          router.replace(`/login?error=${encodeURIComponent(reason)}`)
        }
        return
      }

      // NextAuth owns the session now; hard navigation so the SessionProvider
      // picks up the new cookie on the next render.
      const safeNext = next.startsWith("/") ? next : "/profile"
      window.location.href = safeNext
    }

    bridge().catch((err) => {
      console.error("[auth/complete] bridge error:", err)
      setError("unexpected_error")
      router.replace("/login?error=bridge_failed")
    })
  }, [next, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">
          {error ? "Redirecting…" : "Signing you in…"}
        </p>
      </div>
    </div>
  )
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Signing you in…</p>
          </div>
        </div>
      }
    >
      <AuthCompleteInner />
    </Suspense>
  )
}
