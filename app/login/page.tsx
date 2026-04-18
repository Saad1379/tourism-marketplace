"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, Lock, Mail, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { trackFunnelEvent } from "@/lib/analytics/ga"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { TipWalkLogo } from "@/components/brand/tipwalk-logo"

type LoginFieldErrors = {
  email?: string
  password?: string
}

type LandingStats = {
  activeGuides: number
  activeCities: number
  completedBookings: number
}

const fallbackStats: LandingStats = {
  activeGuides: 500,
  activeCities: 150,
  completedBookings: 50000,
}

function formatCompact(value: number) {
  if (value >= 1000000) return `${Math.round(value / 1000000)}M+`
  if (value >= 1000) return `${Math.round(value / 1000)}K+`
  return `${value}+`
}

function validateLoginFields(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  const trimmedEmail = email.trim()

  if (!trimmedEmail) {
    errors.email = "Email is required"
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = "Enter a valid email address"
  }

  if (!password) {
    errors.password = "Password is required"
  }

  return errors
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || ""
  const guidePending = searchParams.get("guide_pending") === "1"

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [touched, setTouched] = useState({ email: false, password: false })
  const [stats, setStats] = useState<LandingStats>(fallbackStats)

  // MFA state
  const [showMfaChallenge, setShowMfaChallenge] = useState(false)
  const [mfaOTP, setMfaOTP] = useState("")
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadStats = async () => {
      try {
        const response = await fetch("/api/landing/stats", { cache: "no-store" })
        if (!response.ok) return
        const data = await response.json()
        if (!isMounted) return
        setStats({
          activeGuides: Number(data?.activeGuides || fallbackStats.activeGuides),
          activeCities: Number(data?.activeCities || fallbackStats.activeCities),
          completedBookings: Number(data?.completedBookings || fallbackStats.completedBookings),
        })
      } catch {
        // Keep fallback stats silently
      }
    }

    loadStats()
    return () => {
      isMounted = false
    }
  }, [])

  const hasFieldErrors = useMemo(
    () => Boolean(fieldErrors.email || fieldErrors.password),
    [fieldErrors.email, fieldErrors.password],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const nextErrors = validateLoginFields(email, password)
    setFieldErrors(nextErrors)
    setTouched({ email: true, password: true })

    if (nextErrors.email || nextErrors.password) {
      return
    }

    setIsLoading(true)
    const trimmedEmail = email.trim()
    const supabase = createClient()

    trackFunnelEvent("auth_started", {
      auth_method: "password",
      entry_page: "/login",
      redirect_present: Boolean(redirectTo),
    })

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
        options: {
          ...(rememberMe && {
            data: { remember_me: true },
          }),
        },
      })

      if (authError) {
        throw authError
      }

      if (!data.user?.email_confirmed_at) {
        setError("Please verify your email before logging in. Check your inbox for the confirmation link.")
        setIsLoading(false)
        return
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const verifiedFactors = factorsData?.all?.filter((factor: { status: string }) => factor.status === "verified") || []

      if (verifiedFactors.length > 0 && aalData?.currentLevel === "aal1") {
        setMfaFactorId(verifiedFactors[0].id)
        setShowMfaChallenge(true)
        setIsLoading(false)
        return
      }

      const { data: profile } = await supabase.from("profiles").select("role, guide_approval_status").eq("id", data.user.id).single()

      const role = profile?.role || data.user?.user_metadata?.role || "tourist"

      // Block guides who haven't been approved yet
      if (role === "guide" && profile?.guide_approval_status === "pending") {
        await supabase.auth.signOut()
        setError("Your guide application is currently under review. You will receive an email once it has been approved.")
        setIsLoading(false)
        return
      }

      if (role === "guide" && profile?.guide_approval_status === "rejected") {
        await supabase.auth.signOut()
        setError("Your guide application was not approved. Please contact support for more information.")
        setIsLoading(false)
        return
      }

      let redirectUrl: string
      if (redirectTo) {
        redirectUrl = redirectTo
      } else if (role === "admin") {
        redirectUrl = "/admin"
      } else if (role === "guide") {
        redirectUrl = "/dashboard"
      } else {
        redirectUrl = "/profile"
      }

      trackFunnelEvent("auth_completed", {
        auth_method: "password",
        user_role: role,
        entry_page: "/login",
      })

      window.location.href = redirectUrl
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during sign in"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || mfaOTP.length !== 6) return

    setIsVerifyingMfa(true)
    setError(null)

    const supabase = createClient()
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      })
      if (challengeError) throw challengeError

      const { data, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaOTP,
      })

      if (verifyError) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel !== "aal2") {
          throw new Error(verifyError.message || "Invalid verification code")
        }
      }

      const { data: mfaProfile } = await supabase.from("profiles").select("role, guide_approval_status").eq("id", data.user.id).single()
      const role = mfaProfile?.role || data.user?.user_metadata?.role || "tourist"

      if (role === "guide" && mfaProfile?.guide_approval_status === "pending") {
        await supabase.auth.signOut()
        setError("Your guide application is currently under review. You will receive an email once it has been approved.")
        setIsVerifyingMfa(false)
        return
      }

      if (role === "guide" && mfaProfile?.guide_approval_status === "rejected") {
        await supabase.auth.signOut()
        setError("Your guide application was not approved. Please contact support for more information.")
        setIsVerifyingMfa(false)
        return
      }

      let redirectUrl: string
      if (redirectTo) {
        redirectUrl = redirectTo
      } else if (role === "admin") {
        redirectUrl = "/admin"
      } else if (role === "guide") {
        redirectUrl = "/dashboard"
      } else {
        redirectUrl = "/profile"
      }

      trackFunnelEvent("auth_completed", {
        auth_method: "password_mfa",
        user_role: role,
        entry_page: "/login",
      })

      window.location.href = redirectUrl
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid verification code")
    } finally {
      setIsVerifyingMfa(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    trackFunnelEvent("auth_started", {
      auth_method: "google",
      entry_page: "/login",
      redirect_present: Boolean(redirectTo),
    })

    try {
      const supabase = createClient()
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?role=tourist`,
        },
      })

      if (oauthError) throw oauthError

      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during Google sign in"
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <div className="h-svh overflow-hidden flex flex-col lg:flex-row">
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto px-4 py-10 sm:px-6 lg:px-10 xl:px-16 bg-background">
        <div className="my-auto mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 inline-flex" aria-label="TipWalk home">
            <TipWalkLogo size="md" />
          </Link>

          <Card className="border-0 px-5 shadow-none">
            <CardHeader className="space-y-1 px-0 pb-6">
              <CardTitle className="text-2xl font-bold text-foreground">
                {showMfaChallenge ? "Security Verification" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                {showMfaChallenge
                  ? "Enter the 6-digit code from your authenticator app"
                  : "Sign in to your account to continue"}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-0 space-y-0">
              {guidePending && !error && (
                <Alert className="mb-5 border-yellow-300 bg-yellow-50 text-yellow-900">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    Your guide application is currently under review. You will receive an email once it has been approved.
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive" className="mb-5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {showMfaChallenge ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center space-y-4">
                    <InputOTP maxLength={6} value={mfaOTP} onChange={setMfaOTP} autoFocus>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={handleVerifyMfa}
                      disabled={isVerifyingMfa || mfaOTP.length !== 6}
                      className="w-full rounded-full py-2.5 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 bg-primary text-primary-foreground"
                    >
                      {isVerifyingMfa ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying...
                        </span>
                      ) : (
                        "Verify & Sign In"
                      )}
                    </button>
                    <button
                      onClick={() => setShowMfaChallenge(false)}
                      className="flex w-full items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to sign in
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => {
                            const nextEmail = e.target.value
                            setEmail(nextEmail)
                            if (touched.email) {
                              setFieldErrors(validateLoginFields(nextEmail, password))
                            }
                          }}
                          onBlur={() => {
                            setTouched((prev) => ({ ...prev, email: true }))
                            setFieldErrors(validateLoginFields(email, password))
                          }}
                          className="pl-10"
                          disabled={isLoading}
                          autoComplete="email"
                          aria-invalid={Boolean(touched.email && fieldErrors.email)}
                        />
                      </div>
                      {touched.email && fieldErrors.email && (
                        <p className="text-xs text-destructive">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => {
                            const nextPassword = e.target.value
                            setPassword(nextPassword)
                            if (touched.password) {
                              setFieldErrors(validateLoginFields(email, nextPassword))
                            }
                          }}
                          onBlur={() => {
                            setTouched((prev) => ({ ...prev, password: true }))
                            setFieldErrors(validateLoginFields(email, password))
                          }}
                          className="pl-10 pr-10"
                          disabled={isLoading}
                          autoComplete="current-password"
                          aria-invalid={Boolean(touched.password && fieldErrors.password)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {touched.password && fieldErrors.password && (
                        <p className="text-xs text-destructive">{fieldErrors.password}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                        disabled={isLoading}
                      />
                      <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">
                        Remember me for 30 days
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || hasFieldErrors}
                      className="w-full rounded-full py-2.5 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 bg-primary text-primary-foreground"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in...
                        </span>
                      ) : (
                        "Sign in"
                      )}
                    </button>
                  </form>

                  <div className="relative my-6">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                      or continue with
                    </span>
                  </div>

                  <Button variant="outline" type="button" className="w-full" isLoading={isLoading} onClick={handleGoogleSignIn}>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </Button>
                </>
              )}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="relative hidden lg:flex lg:w-1/2 shrink-0 overflow-hidden items-center justify-center bg-primary">
        <div className="absolute inset-0 bg-[url('/walking-tour-city-travelers.jpg')] opacity-20 bg-cover bg-center" />
        <div className="relative z-10 max-w-md px-10 text-center">
          <h2 className="text-3xl font-bold text-white leading-snug">Discover the world with local guides</h2>
          <p className="mt-4 text-base text-white/85 leading-relaxed">
            Join thousands of travelers exploring cities through authentic tip-based tours led by passionate locals.
          </p>
          <div className="mt-10 flex justify-center gap-10 text-white/80">
            <div>
              <p className="text-3xl font-bold text-white">{formatCompact(stats.completedBookings)}</p>
              <p className="text-sm mt-0.5">Happy Travelers</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{formatCompact(stats.activeGuides)}</p>
              <p className="text-sm mt-0.5">Local Guides</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{formatCompact(stats.activeCities)}</p>
              <p className="text-sm mt-0.5">Cities</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-background/10" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-background/10" />
      </div>
    </div>
  )
}
