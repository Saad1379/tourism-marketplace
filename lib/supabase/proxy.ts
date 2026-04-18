import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseEnv } from "./env"

let hasWarnedMissingEnv = false

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const env = getSupabaseEnv()
  if (!env) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Supabase credentials missing: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY not set in environment",
      )
    }

    if (!hasWarnedMissingEnv) {
      hasWarnedMissingEnv = true
      console.warn(
        "[v0] Supabase environment variables are missing. Skipping auth proxy checks until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured.",
      )
    }
    return supabaseResponse
  }

  const supabase = createServerClient(
    env.url,
    env.key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Evaluate MFA requirements
  let requiresMfa = false
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const hasVerifiedFactors = factorsData?.all?.some((f: any) => f.status === 'verified')
      if (hasVerifiedFactors) {
         requiresMfa = true
      }
    }
  }

  const pathname = request.nextUrl.pathname

  // Admin routes: require authentication AND admin role
  if (pathname.startsWith("/admin")) {
    if (!user || requiresMfa) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("redirect", pathname)
      return NextResponse.redirect(url)
    }
    // Fetch profile to verify admin role from DB (not just user_metadata)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Also protect admin API routes
  if (pathname.startsWith("/api/admin")) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Protected routes that require authentication
  const protectedPaths = ["/dashboard", "/profile", "/bookings"]
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path))

  if (isProtectedPath) {
    if (!user || requiresMfa) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("redirect", pathname)
      return NextResponse.redirect(url)
    }

    // Block guides pending approval from accessing the dashboard
    if (pathname.startsWith("/dashboard")) {
      const { data: guideProfile } = await supabase
        .from("profiles")
        .select("role, guide_approval_status")
        .eq("id", user.id)
        .single()

      if (
        guideProfile?.role === "guide" &&
        guideProfile.guide_approval_status !== "approved" &&
        guideProfile.guide_approval_status != null
      ) {
        // Sign them out and redirect to login with a message
        return NextResponse.redirect(new URL("/login?guide_pending=1", request.url))
      }
    }
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ["/login", "/register"]
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path))

  if (isAuthPath && user && !requiresMfa) {
    const url = request.nextUrl.clone()
    // Check user role and redirect accordingly
    const role = user.user_metadata?.role || "tourist"
    url.pathname = role === "guide" ? "/dashboard" : "/profile"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
