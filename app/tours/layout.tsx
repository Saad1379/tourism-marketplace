import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Free Walking Tours | Explore cities across Europe | Touricho",
  description:
    "Discover amazing free walking tours in 35+ cities across Europe. Book authentic local experiences with passionate guides. Pay what you want, tip-based tours.",
  keywords: [
    "free walking tours",
    "city tours",
    "local guides",
    "travel experiences",
    "sightseeing",
    "guided tours",
    "Europe tours",
    "budget travel",
  ],
  alternates: { canonical: "/tours" },
  openGraph: {
    title: "Free Walking Tours | Explore cities across Europe",
    description:
      "Discover amazing free walking tours in 35+ cities across Europe. Book authentic local experiences with passionate guides.",
    type: "website",
    url: "/tours",
    images: [{ url: "/og-tours.jpg", width: 1200, height: 630, alt: "Free Walking Tours Worldwide" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Walking Tours | Explore cities across Europe",
    description:
      "Discover amazing free walking tours in 35+ cities across Europe. Book authentic local experiences with passionate guides.",
    images: ["/og-tours.jpg"],
  },
}

export default function ToursLayout({ children }: { children: React.ReactNode }) {
  return children
}
