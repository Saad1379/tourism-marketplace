import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "My Bookings | Touricho",
  description: "View and manage your tour bookings, upcoming trips, and past experiences.",
  robots: "noindex, nofollow",
}

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
