"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ExternalLink, Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type TourQrReviewClientProps = {
  token: string
}

type ActiveSession = {
  sessionId: string
  scheduleId: string
  startTime: string | null
  slotsTotal: number
  slotsUsed: number
  slotsRemaining: number
  expiresAt: string | null
  status: "active" | "closed" | "expired" | null
  isOpen: boolean
}

type TourQrState = {
  tourId: string
  guideId: string
  tourTitle: string
  guideName: string
  activeSessions: ActiveSession[]
  hasOpenSession: boolean
}

type SubmitResult = {
  reviewId: string
  sessionId: string
  remainingSlots: number
  googleReviewUrl: string | null
  trustpilotReviewUrl: string | null
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.31h6.46a5.52 5.52 0 0 1-2.39 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.67z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.92l-3.88-3c-1.08.72-2.46 1.15-4.05 1.15-3.11 0-5.74-2.1-6.68-4.93H1.3v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.32 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.3a12 12 0 0 0 0 10.78l4.02-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.81l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.61L5.32 9.7c.94-2.83 3.57-4.93 6.68-4.93z"
      />
    </svg>
  )
}

function TrustpilotMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#00B67A" />
      <path
        fill="#fff"
        d="M12 4.8l2.15 4.36 4.81.7-3.48 3.39.82 4.79L12 15.88 7.7 18.04l.82-4.79-3.48-3.39 4.81-.7L12 4.8z"
      />
    </svg>
  )
}

function formatDateTime(value: string | null): string {
  if (!value) return "Time not available"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Time not available"
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function TourQrReviewClient({ token }: TourQrReviewClientProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tourState, setTourState] = useState<TourQrState | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string>("")
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [dismissExternalReviewPrompt, setDismissExternalReviewPrompt] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [reviewerName, setReviewerName] = useState("")

  const loadTourState = useCallback(async () => {
    try {
      const res = await fetch(`/api/review-qr/t/${encodeURIComponent(token)}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load review session.")
      }

      const nextState = data as TourQrState
      setTourState(nextState)
      setError(null)

      if (nextState.activeSessions.length === 1) {
        setSelectedSessionId(nextState.activeSessions[0].sessionId)
      } else if (nextState.activeSessions.length > 1) {
        setSelectedSessionId((prev) => {
          if (prev && nextState.activeSessions.some((session) => session.sessionId === prev)) {
            return prev
          }
          return nextState.activeSessions[0].sessionId
        })
      } else {
        setSelectedSessionId("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load review session.")
      setTourState(null)
      setSelectedSessionId("")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadTourState()
  }, [loadTourState])

  useEffect(() => {
    if (!tourState?.hasOpenSession || submitResult) return
    const poller = window.setInterval(() => {
      void loadTourState()
    }, 15000)
    return () => window.clearInterval(poller)
  }, [tourState?.hasOpenSession, submitResult, loadTourState])

  const selectedSession = useMemo(() => {
    if (!tourState) return null
    return tourState.activeSessions.find((session) => session.sessionId === selectedSessionId) || null
  }, [tourState, selectedSessionId])

  const handleSubmit = async () => {
    if (!tourState?.hasOpenSession || submitting || !selectedSessionId) return
    if (content.trim().length < 20) {
      setError("Please write at least 20 characters.")
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      const res = await fetch(`/api/review-qr/t/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: selectedSessionId,
          rating,
          title,
          content,
          reviewer_name: reviewerName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Unable to submit review.")
      }

      setSubmitResult({
        reviewId: String(data.reviewId),
        sessionId: String(data.sessionId || selectedSessionId),
        remainingSlots: Number(data.remainingSlots || 0),
        googleReviewUrl: typeof data.googleReviewUrl === "string" ? data.googleReviewUrl : null,
        trustpilotReviewUrl: typeof data.trustpilotReviewUrl === "string" ? data.trustpilotReviewUrl : null,
      })
      setDismissExternalReviewPrompt(false)

      setTourState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          activeSessions: prev.activeSessions.map((session) =>
            session.sessionId === selectedSessionId
              ? {
                  ...session,
                  slotsRemaining: Number(data.remainingSlots || session.slotsRemaining),
                  slotsUsed: Math.max(0, session.slotsTotal - Number(data.remainingSlots || session.slotsRemaining)),
                }
              : session,
          ),
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit review.")
      await loadTourState()
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleClick = async () => {
    if (!submitResult?.googleReviewUrl) return
    // Open immediately from user gesture to avoid popup blockers.
    window.open(submitResult.googleReviewUrl, "_blank", "noopener,noreferrer")

    // Fire-and-forget analytics.
    void fetch(`/api/review-qr/t/${encodeURIComponent(token)}/google-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        review_id: submitResult.reviewId,
        session_id: submitResult.sessionId,
      }),
    }).catch(() => {
      // Non-blocking analytics event.
    })
  }

  const handleTrustpilotClick = () => {
    if (!submitResult?.trustpilotReviewUrl) return
    window.open(submitResult.trustpilotReviewUrl, "_blank", "noopener,noreferrer")
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading review form...
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Tour Review</CardTitle>
          <CardDescription>
            {tourState ? `How was "${tourState.tourTitle}" with ${tourState.guideName}?` : "Leave your review."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {submitResult ? (
            <div className="space-y-4 rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <div className="flex items-center gap-2 text-secondary">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">Thanks for your review.</p>
              </div>
              <p className="text-sm text-muted-foreground">Your verified review was submitted successfully.</p>
              <p className="text-sm text-muted-foreground">
                Remaining verified slots: <span className="font-medium text-foreground">{submitResult.remainingSlots}</span>
              </p>
              {submitResult.googleReviewUrl || submitResult.trustpilotReviewUrl ? (
                dismissExternalReviewPrompt ? (
                  <div className="rounded-lg border border-border bg-background/90 p-3">
                    <p className="text-sm text-muted-foreground">
                      Skipped external reviews. You can close this page anytime.
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="mt-1 h-auto p-0 text-sm"
                      onClick={() => setDismissExternalReviewPrompt(false)}
                    >
                      Show Google & Trustpilot options again
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border border-border bg-background/90 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Optional: share on public platforms</p>
                      <p className="text-xs text-muted-foreground">This helps other travelers discover Touricho.</p>
                    </div>

                    <div className="space-y-2">
                      {submitResult.googleReviewUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGoogleClick}
                          className="w-full justify-between gap-2 border-[#DADCE0] bg-white text-[#1F1F1F] hover:bg-[#F8F9FA]"
                        >
                          <span className="flex items-center gap-2">
                            <GoogleMark />
                            <span>Review Touricho on Google</span>
                          </span>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      ) : null}

                      {submitResult.trustpilotReviewUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTrustpilotClick}
                          className="w-full justify-between gap-2 border-[#00B67A]/30 bg-[#F3FFFA] text-[#093F2C] hover:bg-[#E6FAF2]"
                        >
                          <span className="flex items-center gap-2">
                            <TrustpilotMark />
                            <span>Review Touricho on Trustpilot</span>
                          </span>
                          <ExternalLink className="h-4 w-4 text-[#0B8F5A]" />
                        </Button>
                      ) : null}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setDismissExternalReviewPrompt(true)}
                      >
                        Skip for now
                      </Button>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          ) : (
            <>
              {!tourState?.hasOpenSession ? (
                <div className="rounded-md border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
                  Reviews are not open for this tour right now. Please scan again at the end of the tour.
                </div>
              ) : (
                <>
                  {tourState.activeSessions.length > 1 ? (
                    <div className="space-y-2">
                      <Label>Select your tour time</Label>
                      <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose your tour slot" />
                        </SelectTrigger>
                        <SelectContent>
                          {tourState.activeSessions.map((session) => (
                            <SelectItem key={session.sessionId} value={session.sessionId}>
                              {formatDateTime(session.startTime)} · {session.slotsRemaining} slots left
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {selectedSession ? (
                    <div className="rounded-xl border p-4 text-sm">
                      <p>
                        Remaining verified slots:{" "}
                        <span className="font-semibold">{selectedSession.slotsRemaining}</span> / {selectedSession.slotsTotal}
                      </p>
                      <p className="mt-1 text-muted-foreground">Tour time: {formatDateTime(selectedSession.startTime)}</p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Rating</Label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => setRating(value)}
                          className="rounded p-1"
                          aria-label={`Set rating to ${value}`}
                        >
                          <Star
                            className={`h-7 w-7 ${
                              value <= rating ? "fill-chart-3 text-chart-3" : "text-muted-foreground/40"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewer_name">Your Name (optional)</Label>
                    <Input
                      id="reviewer_name"
                      value={reviewerName}
                      onChange={(event) => setReviewerName(event.target.value)}
                      placeholder="e.g. Anna"
                      maxLength={80}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review_title">Title (optional)</Label>
                    <Input
                      id="review_title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="e.g. Great tour!"
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review_content">Your Review</Label>
                    <Textarea
                      id="review_content"
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder="Tell others about your experience..."
                      rows={6}
                      maxLength={1500}
                    />
                    <p className="text-xs text-muted-foreground">{content.length}/1500 (minimum 20)</p>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedSessionId || !tourState.hasOpenSession}
                    className="w-full"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Verified Review"
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
