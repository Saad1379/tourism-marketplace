import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { absolute: "Sign In | TipWalk" },
  description: "Sign in to your TipWalk account to manage bookings, view tours, and connect with guides.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Sign In | TipWalk",
    description: "Sign in to your TipWalk account.",
    url: "/login",
    type: "website",
  },
  alternates: { canonical: "/login" },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
