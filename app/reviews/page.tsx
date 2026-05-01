import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { getPublicReviews, getLandingStats } from "@/lib/supabase/queries"
import { getStorageUrl } from "@/lib/utils"
import { ReviewsClient, type PublicReviewItem } from "./reviews-client"

export const metadata: Metadata = {
  title: "Reviews",
  description:
    "Read verified traveler reviews from real Touricho bookings. Explore honest feedback about local guides, cities, and tour experiences.",
  keywords: [
    "walking tour reviews",
    "verified traveler reviews",
    "local guide ratings",
    "touricho reviews",
    "city tour feedback",
  ],
  openGraph: {
    title: "Reviews | Touricho",
    description: "Verified traveler feedback from real Touricho bookings.",
    url: "/reviews",
    type: "website",
  },
  alternates: { canonical: "/reviews" },
}

function mapReviewToPublicItem(review: any): PublicReviewItem {
  const tourist = Array.isArray(review?.tourist) ? review.tourist[0] : review?.tourist
  const tour = Array.isArray(review?.tour) ? review.tour[0] : review?.tour
  const safeDate = review?.created_at ? new Date(review.created_at) : null
  const isValidDate = safeDate instanceof Date && !Number.isNaN(safeDate.getTime())

  return {
    id: String(review?.id || `${review?.created_at || "review"}-${tour?.title || "tour"}`),
    authorName: tourist?.full_name || "Anonymous Traveler",
    authorAvatar: getStorageUrl(tourist?.avatar_url, "avatars"),
    rating: Math.max(1, Math.min(5, Number(review?.rating || 5))),
    date: isValidDate
      ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(safeDate)
      : "Recently",
    createdAt: isValidDate ? safeDate.toISOString() : new Date().toISOString(),
    content: review?.content || review?.title || "Great experience with a local guide.",
    tourTitle: tour?.title || "Walking Tour",
    city: tour?.city || "",
  }
}

export default async function ReviewsPage() {
  const [dbReviews, landingStats] = await Promise.all([getPublicReviews(120), getLandingStats()])
  const reviews = dbReviews.map(mapReviewToPublicItem)
  const totalReviews = landingStats.totalReviews > 0 ? landingStats.totalReviews : reviews.length

  return (
    <div className="public-template-page landing-template">
      <Navbar variant="landingTemplate" />
      <ReviewsClient reviews={reviews} totalReviews={totalReviews} />
      <Footer variant="landingTemplate" />
    </div>
  )
}
