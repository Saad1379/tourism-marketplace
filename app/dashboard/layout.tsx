import type React from "react"
import type { Metadata } from "next"
import { DashboardLayoutPage } from "@/components/shared/dashboard-layout"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Guide Dashboard | TipWalk",
  description: "Manage your tours, bookings, messages, and earnings from your TipWalk guide dashboard.",
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

  if (!profile || profile.role !== "guide") {
    redirect("/")
  }

  return <DashboardLayoutPage>{children}</DashboardLayoutPage>
}
