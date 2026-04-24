"use client"

import type React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Compass, Eye, EyeOff, Lock, Mail, User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { formatAuthError } from "@/lib/utils"
import { trackFunnelEvent } from "@/lib/analytics/ga"
import { TipWalkLogo } from "@/components/brand/tipwalk-logo"

type UserRole = "tourist" | "guide"

type RegisterForm = {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  agreeTerms: boolean
}

type RegisterErrors = Partial<Record<keyof RegisterForm, string>>

type PasswordCheck = {
  id: string
  label: string
  passed: boolean
}

const initialForm: RegisterForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  agreeTerms: false,
}

function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { id: "length", label: "At least 8 characters", passed: password.length >= 8 },
    { id: "uppercase", label: "One uppercase letter", passed: /[A-Z]/.test(password) },
    { id: "lowercase", label: "One lowercase letter", passed: /[a-z]/.test(password) },
    { id: "number", label: "One number", passed: /\d/.test(password) },
    {
      id: "special",
      label: "One special character",
      passed: /[!@#$%^&*()_\-=[\]{};':"\\|,.<>/?`~]/.test(password),
    },
  ]
}

function validateRegisterForm(formData: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {}
  const trimmedEmail = formData.email.trim()

  if (!formData.firstName.trim()) errors.firstName = "First name is required"
  if (!formData.lastName.trim()) errors.lastName = "Last name is required"

  if (!trimmedEmail) {
    errors.email = "Email is required"
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = "Enter a valid email address"
  }

  const passwordChecks = getPasswordChecks(formData.password)
  if (!formData.password) {
    errors.password = "Password is required"
  } else if (!passwordChecks.every((check) => check.passed)) {
    errors.password = "Password does not meet the minimum security requirements"
  }

  if (!formData.confirmPassword) {
    errors.confirmPassword = "Please confirm your password"
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = "Passwords do not match"
  }

  if (!formData.agreeTerms) {
    errors.agreeTerms = "You must agree to the Terms and Privacy Policy"
  }

  return errors
}

function getStrengthLabel(score: number) {
  if (score <= 2) return { label: "Weak", className: "text-destructive" }
  if (score <= 4) return { label: "Fair", className: "text-primary" }
  return { label: "Strong", className: "text-secondary" }
}

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [role, setRole] = useState<UserRole>("tourist")
  const [formData, setFormData] = useState<RegisterForm>(initialForm)
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterForm, boolean>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordChecks = useMemo(() => getPasswordChecks(formData.password), [formData.password])
  const passedPasswordChecks = passwordChecks.filter((check) => check.passed).length
  const passwordStrength = getStrengthLabel(passedPasswordChecks)

  const updateFormData = <K extends keyof RegisterForm>(field: K, value: RegisterForm[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (touched[field]) {
        setFieldErrors(validateRegisterForm(next))
      }
      return next
    })
  }

  const markTouched = (field: keyof RegisterForm) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setFieldErrors(validateRegisterForm(formData))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const nextErrors = validateRegisterForm(formData)
    setFieldErrors(nextErrors)
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
      agreeTerms: true,
    })

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    trackFunnelEvent("auth_started", {
      auth_method: "password",
      auth_intent: "signup",
      user_role: role,
      entry_page: "/register",
    })

    try {
      const redirectUrl = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback`
      const urlWithRole = new URL(redirectUrl)
      if (role === "guide") {
        urlWithRole.searchParams.set("role", "guide")
      }

      const { error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: urlWithRole.toString(),
          data: {
            full_name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            // Picked up by the handle_new_user trigger so the profile is
            // created with the right role on first insert — we don't have to
            // wait for the email-confirmation callback to fix it up.
            requested_role: role,
          },
        },
      })

      if (authError) throw authError

      trackFunnelEvent("auth_completed", {
        auth_method: "password",
        auth_intent: "signup",
        user_role: role,
        entry_page: "/register",
      })

      router.push("/auth/sign-up-success")
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during registration"
      setError(formatAuthError(errorMessage))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    trackFunnelEvent("auth_started", {
      auth_method: "google",
      auth_intent: "signup",
      user_role: role,
      entry_page: "/register",
    })

    try {
      const supabase = createClient()
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?role=${role}`,
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

  const passwordsMatch = formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword

  return (
    <div className="h-svh overflow-hidden flex flex-col lg:flex-row">
      <div className="relative hidden lg:flex lg:w-1/2 shrink-0 overflow-hidden items-center justify-center bg-secondary">
        <div className="absolute inset-0 bg-[url('/adventure-travel-walking.jpg')] opacity-20 bg-cover bg-center" />
        <div className="relative z-10 max-w-md px-10 text-center">
          <h2 className="text-3xl font-bold text-white leading-snug">Start your journey today</h2>
          <p className="mt-4 text-base text-white/85 leading-relaxed">
            Whether you want to explore new cities or share your local knowledge, TipWalk connects you with unforgettable tip-based experiences.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-background/10 backdrop-blur-sm p-5">
              <Compass className="mx-auto h-7 w-7 text-white" />
              <p className="mt-3 font-semibold text-white text-sm">For Travelers</p>
              <p className="mt-1 text-xs text-white/80 leading-relaxed">Book free tours and discover cities like a local</p>
            </div>
            <div className="rounded-2xl bg-background/10 backdrop-blur-sm p-5">
              <Users className="mx-auto h-7 w-7 text-white" />
              <p className="mt-3 font-semibold text-white text-sm">For Guides</p>
              <p className="mt-1 text-xs text-white/80 leading-relaxed">Share your passion and keep 100% of every tip</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-background/10" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-background/10" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto px-4 py-10 sm:px-6 lg:px-10 xl:px-16 bg-background">
        <div className="my-auto mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 inline-flex" aria-label="TipWalk home">
            <TipWalkLogo size="md" />
          </Link>

          <Card className="border-0 px-5 shadow-none">
            <CardHeader className="space-y-1 px-0 pb-6">
              <CardTitle className="text-2xl font-bold text-foreground">Create an account</CardTitle>
              <CardDescription>Join TipWalk and start exploring</CardDescription>
            </CardHeader>

            <CardContent className="px-0">
              {error && (
                <Alert variant="destructive" className="mb-5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="mb-5">
                <Label className="mb-3 block text-sm font-medium">I want to join as a</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["tourist", "guide"] as const).map((currentRole) => (
                    <button
                      key={currentRole}
                      type="button"
                      onClick={() => setRole(currentRole)}
                      disabled={isLoading}
                      className={`flex flex-col items-center rounded-xl border-2 p-4 transition-all ${
                        role === currentRole
                          ? "border-primary bg-primary/6"
                          : "border-border hover:border-border/70 hover:bg-muted/60"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {currentRole === "tourist" ? (
                        <Compass className={`h-6 w-6 ${role === currentRole ? "text-primary" : "text-muted-foreground"}`} />
                      ) : (
                        <Users className={`h-6 w-6 ${role === currentRole ? "text-primary" : "text-muted-foreground"}`} />
                      )}
                      <span className={`mt-2 text-sm font-medium capitalize ${role === currentRole ? "text-primary" : "text-foreground"}`}>
                        {currentRole === "tourist" ? "Traveler" : "Guide"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => updateFormData("firstName", e.target.value)}
                        onBlur={() => markTouched("firstName")}
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="given-name"
                        aria-invalid={Boolean(touched.firstName && fieldErrors.firstName)}
                      />
                    </div>
                    {touched.firstName && fieldErrors.firstName && (
                      <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => updateFormData("lastName", e.target.value)}
                      onBlur={() => markTouched("lastName")}
                      disabled={isLoading}
                      autoComplete="family-name"
                      aria-invalid={Boolean(touched.lastName && fieldErrors.lastName)}
                    />
                    {touched.lastName && fieldErrors.lastName && (
                      <p className="text-xs text-destructive">{fieldErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      onBlur={() => markTouched("email")}
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
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={formData.password}
                      onChange={(e) => updateFormData("password", e.target.value)}
                      onBlur={() => markTouched("password")}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      autoComplete="new-password"
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

                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Password strength: <span className={passwordStrength.className}>{passwordStrength.label}</span>
                    </p>
                    <ul className="space-y-1">
                      {passwordChecks.map((check) => (
                        <li
                          key={check.id}
                          className={`text-xs ${check.passed ? "text-secondary" : "text-muted-foreground"}`}
                        >
                          {check.passed ? "✓" : "•"} {check.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {touched.password && fieldErrors.password && (
                    <p className="text-xs text-destructive">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                      onBlur={() => markTouched("confirmPassword")}
                      className={`pl-10 pr-10 ${
                        formData.confirmPassword.length > 0
                          ? passwordsMatch
                            ? "border-secondary focus-visible:ring-secondary"
                            : "border-destructive focus-visible:ring-destructive"
                          : ""
                      }`}
                      disabled={isLoading}
                      autoComplete="new-password"
                      aria-invalid={Boolean(touched.confirmPassword && fieldErrors.confirmPassword)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {formData.confirmPassword.length > 0 && (
                    <p className={`text-xs font-medium ${passwordsMatch ? "text-secondary" : "text-destructive"}`}>
                      {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                    </p>
                  )}
                  {touched.confirmPassword && fieldErrors.confirmPassword && (
                    <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="terms"
                      checked={formData.agreeTerms}
                      onCheckedChange={(checked) => {
                        const nextChecked = Boolean(checked)
                        updateFormData("agreeTerms", nextChecked)
                        setTouched((prev) => ({ ...prev, agreeTerms: true }))
                        setFieldErrors(validateRegisterForm({ ...formData, agreeTerms: nextChecked }))
                      }}
                      className="mt-0.5 shrink-0"
                      disabled={isLoading}
                    />
                    <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-snug">
                      I agree to TipWalk's{" "}
                      <Link href="/terms" className="text-primary hover:underline font-medium">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-primary hover:underline font-medium">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                  {touched.agreeTerms && fieldErrors.agreeTerms && (
                    <p className="text-xs text-destructive">{fieldErrors.agreeTerms}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-full py-2.5 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 bg-primary text-primary-foreground"
                >
                  {isLoading ? "Creating account..." : "Create account"}
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

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
