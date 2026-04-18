"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/supabase/auth-context"
import { Star, ArrowLeft, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/loading-spinner"
import { EmptyState } from "@/components/shared/empty-state"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

export default function GuideReviewsPage() {
  const router = useRouter()
  const { user, session, profile, isLoading } = useAuth()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<any | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!isLoading && !session) router.push("/login")
  }, [isLoading, session, router])

  useEffect(() => {
    if (!isLoading && profile && profile.role !== "guide") router.push("/")
  }, [isLoading, profile, router])

  useEffect(() => {
    const fetchReviews = async () => {
      if (!user || !session) return

      try {
        setLoading(true)
        const response = await fetch("/api/reviews", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setReviews(Array.isArray(data) ? data : [])
        } else {
          setError("Failed to load reviews")
        }
      } catch (err) {
        setError("Failed to load reviews")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (user && session) fetchReviews()
  }, [user, session])

  const handleReplySubmit = async () => {
    if (!replyingTo || !replyContent.trim()) return

    try {
      setIsSubmitting(true)
      const response = await fetch("/api/reviews/update-response", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          review_id: replyingTo.id,
          guide_response: replyContent,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit reply")
      }

      const updatedReview = await response.json()

      // Update local state
      setReviews((prev) =>
        prev.map((r) => (r.id === updatedReview.id ? { ...r, guide_response: updatedReview.guide_response } : r)),
      )

      toast({
        title: "Reply submitted",
        description: "Your response is now public.",
      })

      setReplyingTo(null)
      setReplyContent("")
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to submit reply. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session || !profile || profile.role !== "guide") return null

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0

  return (
    <>
      <main className="p-4 lg:p-6 space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold">Guest Reviews</h1>
            <p className="text-sm text-muted-foreground">
              {reviews.length} total reviews • {averageRating} average rating
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </Link>
        </section>

        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {reviews.length > 0 ? (
          <div className="space-y-6">
            {/* Rating Summary */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Rating Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="flex flex-col items-center justify-center p-4 border border-border rounded-lg bg-accent/10">
                    <div className="text-3xl font-bold">{averageRating}</div>
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.round(Number(averageRating)) ? "fill-chart-3 text-chart-3" : "text-muted"}`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">Average</div>
                  </div>
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = reviews.filter((r: any) => r.rating === rating).length
                    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                    return (
                      <div key={rating} className="flex flex-col items-center justify-center p-4 border border-border rounded-lg">
                        <div className="text-lg font-semibold">{rating}</div>
                        <Star className="h-4 w-4 fill-chart-3 text-chart-3 my-1" />
                        <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-chart-3" style={{ width: `${percentage}%` }} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">{count} reviews</div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Reviews List */}
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <Card key={review.id} className="border-border bg-card hover:shadow-sm transition-shadow">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-foreground">{review.tourist?.full_name || "Anonymous"}</h3>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < review.rating ? "fill-chart-3 text-chart-3" : "text-muted"}`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.title && <h4 className="font-medium text-sm mb-2">{review.title}</h4>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4 bg-muted px-2 py-1 rounded">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{review.content}</p>

                    {review.guide_response ? (
                      <div className="bg-accent/30 border border-accent/50 rounded-lg p-4 mb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm text-foreground">Your Response</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{review.guide_response}</p>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setReplyingTo(review)
                          setReplyContent("")
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Reply to Review
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Star}
            title="No reviews yet"
            description="When tourists complete tours, they can leave reviews"
          />
        )}
      </main>

      <Dialog open={!!replyingTo} onOpenChange={(open) => !open && setReplyingTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
            <DialogDescription>
              Your response to {replyingTo?.tourist?.full_name}'s review will be visible to everyone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted p-3 rounded-md text-sm italic">"{replyingTo?.content}"</div>
            <Textarea
              placeholder="Write your professional response here..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyingTo(null)} className="bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleReplySubmit} disabled={isSubmitting || !replyContent.trim()}>
              {isSubmitting ? "Submitting..." : "Post Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
