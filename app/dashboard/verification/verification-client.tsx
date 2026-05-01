"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  ShieldCheck,
  BadgeCheck,
  Loader2,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/supabase/auth-context"
import { useToast } from "@/hooks/use-toast"

const SumsubWebSdk = dynamic(() => import("@sumsub/websdk-react"), { ssr: false })

async function fetchSumsubToken(): Promise<string> {
  const res = await fetch("/api/verification/sumsub-token", { method: "POST" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to load verification" }))
    throw new Error(err.error || "Failed to load verification")
  }
  const data = await res.json()
  return data.token
}

import { isSeller } from "@/lib/marketplace/roles"

export default function VerificationClient() {
  const router = useRouter()
  const { session, profile, isLoading, refreshProfile } = useAuth()
  const { toast } = useToast()

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading) {
      if (!session) router.push("/login")
      if (profile && !isSeller(profile.role)) router.push("/")
    }
  }, [isLoading, session, profile, router])

  // Poll for guide_verified once the user has submitted — stops when verified
  useEffect(() => {
    if (!submitted || profile?.guide_verified) return
    const interval = setInterval(() => refreshProfile(), 5000)
    return () => clearInterval(interval)
  }, [submitted, profile?.guide_verified, refreshProfile])

  // Fetch token once — skip if already have a token, already submitted, or already verified
  useEffect(() => {
    if (!session || !profile || !isSeller(profile.role) || profile.guide_verified || accessToken || submitted) return
    setTokenLoading(true)
    fetchSumsubToken()
      .then((token) => setAccessToken(token))
      .catch((err) => setTokenError(err.message))
      .finally(() => setTokenLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, profile?.id, profile?.guide_verified, submitted])

 
  const accessTokenExpirationHandler = useCallback(async (): Promise<string> => {
    const token = await fetchSumsubToken()
    setAccessToken(token)
    return token
  }, [])

  const messageHandler = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      console.log("[sumsub] message:", type, payload)
      if (type === "idCheck.onApplicantStatusChanged") {
        const reviewStatus = (payload as any)?.reviewStatus
        if (reviewStatus === "completed") {
          setSubmitted(true)
          toast({ title: "Verification submitted", description: "We'll confirm your identity shortly." })
        }
      }
    },
    [toast]
  )

  const errorHandler = useCallback(
    (error: unknown) => {
      console.error("[sumsub] error:", error)
      toast({ title: "Verification error", description: "Something went wrong. Please try again.", variant: "destructive" })
    },
    [toast]
  )

  const isVerified = profile?.guide_verified === true

  return (
    <main className="min-h-screen bg-muted/30 p-4 lg:p-6 space-y-6">
          <section>
            <h1 className="text-xl font-semibold">Verification</h1>
            <p className="text-sm text-muted-foreground">Submit documents to unlock verified seller status.</p>
          </section>

          <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isVerified ? (
                    <>
                      <BadgeCheck className="w-5 h-5 text-primary" />
                      Identity Verified
                    </>
                  ) : (
                    "Verify Your Identity"
                  )}
                </CardTitle>
                <CardDescription>
                  {isVerified
                    ? "Your identity has been confirmed. Your profile now shows a verified badge."
                    : "Complete the identity check below to unlock your verified seller badge."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isVerified ? (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <BadgeCheck className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">You&apos;re verified!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Travelers can see your verified badge on all your tours and profile.
                      </p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1 text-sm">
                      ✓ Verified Seller
                    </Badge>
                  </div>
                ) : submitted ? (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
                      <ShieldCheck className="h-8 w-8 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">Documents submitted</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your verification is under review. We'll notify you once it's complete — this usually takes a
                        few minutes.
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 px-4 py-1 text-sm">
                      Under Review
                    </Badge>
                  </div>
                ) : tokenLoading ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading verification…</span>
                  </div>
                ) : tokenError ? (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <p className="text-sm text-destructive">{tokenError}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTokenError(null)
                        setTokenLoading(true)
                        fetchSumsubToken()
                          .then(setAccessToken)
                          .catch((err) => setTokenError(err.message))
                          .finally(() => setTokenLoading(false))
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                ) : accessToken ? (
                  <SumsubWebSdk
                    accessToken={accessToken}
                    expirationHandler={accessTokenExpirationHandler}
                    config={{ lang: "en" }}
                    options={{ addViewportTag: false, adaptIframeHeight: true }}
                    onMessage={messageHandler}
                    onError={errorHandler}
                  />
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Why verify?</CardTitle>
                  <CardDescription>Verified sellers earn more trust and bookings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { icon: BadgeCheck, text: "Verified badge on profile and tours" },
                    { icon: ShieldCheck, text: "Higher placement in search results" },
                    { icon: Wallet, text: "Priority support and faster payouts" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <p className="text-sm">{text}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>What you&apos;ll need</CardTitle>
                  <CardDescription>Have these ready before starting.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>• Government-issued photo ID (passport, national ID, or driver&apos;s license)</p>
                  <p>• A device with a working camera for the liveness check</p>
                  <p>• Good lighting and a clear background</p>
                </CardContent>
              </Card>
            </div>
          </section>
    </main>
  )
}
