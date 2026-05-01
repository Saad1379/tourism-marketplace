import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "My Profile | Touricho",
  description: "Manage your Touricho profile, view your travel history, saved tours, and achievements.",
  robots: "noindex, nofollow",
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
