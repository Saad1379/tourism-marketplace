import type { Metadata } from "next"
import AnalyticsClient from "./analytics-client"

export const metadata: Metadata = {
  title: "Analytics | TipWalk",
  description: "Track bookings, attendance, revenue, and performance trends for your tours.",
  robots: "noindex, nofollow",
}

export default function AnalyticsPage() {
  return <AnalyticsClient />
}
