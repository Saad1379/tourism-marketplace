import type { Metadata } from "next"
import AdminOverviewClient from "./overview-client"

export const metadata: Metadata = {
  title: "Admin Overview | TipWalk",
  robots: "noindex, nofollow",
}

export default function AdminOverviewPage() {
  return <AdminOverviewClient />
}
