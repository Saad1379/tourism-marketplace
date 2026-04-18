import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the TipWalk team. We're here to help travelers and guides with bookings, account issues, partnerships, and more. Offices in Barcelona, Berlin, and New York.",
  keywords: ["contact tipwalk", "tipwalk support", "tour help", "guide support", "customer service"],
  openGraph: {
    title: "Contact Us | TipWalk",
    description: "Get in touch with the TipWalk team for tour questions, guide support, and partnerships.",
    url: "/contact",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Contact Us | TipWalk",
    description: "Get in touch with the TipWalk team for tour questions, guide support, and partnerships.",
  },
  alternates: { canonical: "/contact" },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
