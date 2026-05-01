import type React from "react"
import type { Metadata } from "next"
import { BRAND_NAME, toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"

export const metadata: Metadata = {
  title: "Become a Guide",
  description:
    "Start as a Touricho guide on the Free plan and keep it forever, then upgrade to Pro when you need more tour capacity and growth tools.",
  keywords: [
    "become a tour guide",
    "tour guide job",
    "earn money guiding",
    "local guide",
    "walking tour guide",
    "tourism jobs",
    "flexible work",
  ],
  openGraph: {
    title: withBrandSuffix("Become a Guide | Free Forever and Pro Growth"),
    description:
      "Start with Free forever and scale with Pro when demand grows. Share your city, run tours, and manage bookings on Touricho.",
    url: toCanonicalUrl("/become-guide"),
    siteName: BRAND_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: withBrandSuffix("Become a Guide | Free Forever and Pro Growth"),
    description:
      "Start with Free forever and scale with Pro when demand grows. Share your city, run tours, and manage bookings on Touricho.",
  },
  alternates: { canonical: toCanonicalUrl("/become-guide") },
}

export default function BecomeGuideLayout({ children }: { children: React.ReactNode }) {
  return children
}
