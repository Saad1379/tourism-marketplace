import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "How It Works | Free Walking Tours Explained | TipWalk",
  description:
    "Learn how TipWalk's free walking tours work. Simple booking process, pay what you want, and discover cities with passionate local guides.",
  keywords: ["how free tours work", "booking guide", "tour process", "pay what you want tours", "tip-based tours"],
  openGraph: {
    title: "How It Works | Free Walking Tours Explained",
    description: "Learn how TipWalk's free walking tours work. Simple booking, pay what you want.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "How It Works | Free Walking Tours Explained",
    description: "Learn how TipWalk's free walking tours work. Simple booking, pay what you want.",
  },
}

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children
}
