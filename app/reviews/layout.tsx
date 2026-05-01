import type React from "react"
import type { Metadata } from "next"
import { BRAND_NAME, BRAND_SITE_URL, toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"

const SITE_URL = BRAND_SITE_URL

export const metadata: Metadata = {
  title: "Traveler Reviews",
  description:
    `Read authentic reviews from 48,000+ travelers who explored cities across Europe with ${BRAND_NAME} guides. Rated 4.8 out of 5 stars across 35+ destinations.`,
  keywords: ["touricho reviews", "walking tour reviews", "traveler testimonials", "guide ratings", "tour feedback"],
  openGraph: {
    title: withBrandSuffix("Traveler Reviews"),
    description: "Read authentic reviews from 48,000+ travelers. Rated 4.8/5 across 35+ destinations.",
    url: toCanonicalUrl("/reviews"),
    siteName: BRAND_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: withBrandSuffix("Traveler Reviews"),
    description: "Read authentic reviews from 48,000+ travelers. Rated 4.8/5 across 35+ destinations.",
  },
  alternates: { canonical: toCanonicalUrl("/reviews") },
}

const reviewsJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND_NAME,
  url: SITE_URL,
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "48567",
    bestRating: "5",
    worstRating: "1",
  },
}

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsJsonLd) }}
      />
      {children}
    </>
  )
}
