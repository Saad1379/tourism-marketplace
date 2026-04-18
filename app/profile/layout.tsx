import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "My Profile | TipWalk",
  description: "Manage your TipWalk profile, view your travel history, saved tours, and achievements.",
  robots: "noindex, nofollow",
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
