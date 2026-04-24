import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us | Our Story & Mission | TipWalk",
  description:
    "Learn about TipWalk's mission to connect travelers with passionate local guides. Discover our story, values, and the team behind 2,500+ guides in 35+ cities.",
  keywords: [
    "about TipWalk",
    "free walking tours company",
    "travel platform",
    "local guides community",
    "tour company story",
  ],
  openGraph: {
    title: "About TipWalk | Connecting Travelers with Local Guides",
    description: "Learn about TipWalk's mission to connect travelers with passionate local guides worldwide.",
    type: "website",
    images: ["/og-about.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "About TipWalk | Connecting Travelers with Local Guides",
    description: "Learn about TipWalk's mission to connect travelers with passionate local guides worldwide.",
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
