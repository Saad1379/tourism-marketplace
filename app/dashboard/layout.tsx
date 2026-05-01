import type React from "react"
import type { Metadata } from "next"
import { DashboardLayoutPage } from "@/components/shared/dashboard-layout"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

import { isSeller } from "@/lib/marketplace/roles"

export const metadata: Metadata = {
  title: "Seller Dashboard | Touricho",
  description: "Manage your listings, bookings, messages, and earnings from your Touricho seller dashboard.",
  robots: "noindex, nofollow",
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/dashboard")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || !isSeller(profile.role)) {
    redirect("/")
  }

  return <DashboardLayoutPage>{children}</DashboardLayoutPage>
}
