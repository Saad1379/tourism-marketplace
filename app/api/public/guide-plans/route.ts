import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

type PlanType = "free" | "pro"

type PlanSettingsRow = {
  plan_type: PlanType
  max_tours: number
  max_schedules_per_week: number
  max_tourist_capacity: number
  updated_at: string
}

type GuidePlanCard = {
  name: "Free" | "Pro"
  badge: string
  summary: string
  cta: string
  features: string[]
}

const DEFAULT_FREE_LIMITS = {
  max_tours: 1,
  max_schedules_per_week: 2,
  max_tourist_capacity: 7,
}

function pluralize(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`
}

function formatLimit(value: number, singular: string, plural: string) {
  if (value >= 999) {
    return `Unlimited ${plural}`
  }

  return `Up to ${pluralize(value, singular, plural)}`
}

function buildGuidePlans(rows: PlanSettingsRow[]): GuidePlanCard[] {
  const byType = new Map(rows.map((row) => [row.plan_type, row]))
  const free = byType.get("free") ?? {
    plan_type: "free" as const,
    updated_at: new Date().toISOString(),
    ...DEFAULT_FREE_LIMITS,
  }
  const pro = byType.get("pro")

  const freePlan: GuidePlanCard = {
    name: "Free",
    badge: "Free Forever",
    summary: "Free stays free forever. Start guiding with clear limits and no subscription cost.",
    cta: "Start for Free",
    features: [
      `${formatLimit(free.max_tours, "published tour", "published tours")}`,
      `${formatLimit(free.max_schedules_per_week, "schedule", "schedules")} per week`,
      `${formatLimit(free.max_tourist_capacity, "traveler", "travelers")} per tour`,
      "Guide profile, bookings, and messaging tools",
    ],
  }

  const proPlan: GuidePlanCard = pro
    ? {
        name: "Pro",
        badge: "Scale Faster",
        summary: "Built for guides growing demand and needing higher operating limits.",
        cta: "Upgrade to Pro Anytime",
        features: [
          "Everything in Free",
          `${formatLimit(pro.max_tours, "published tour", "published tours")}`,
          `${formatLimit(pro.max_schedules_per_week, "schedule", "schedules")} per week`,
          `${formatLimit(pro.max_tourist_capacity, "traveler", "travelers")} per tour`,
        ],
      }
    : {
        name: "Pro",
        badge: "Scale Faster",
        summary: "Pro removes Free-plan caps so you can scale tours and scheduling without hard limits.",
        cta: "Upgrade to Pro Anytime",
        features: [
          "Everything in Free",
          "No cap on published tours",
          "No cap on schedules per week",
          "No cap on travelers per tour",
        ],
      }

  return [freePlan, proPlan]
}

export async function GET() {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("plan_settings")
      .select("plan_type, max_tours, max_schedules_per_week, max_tourist_capacity, updated_at")
      .in("plan_type", ["free", "pro"])

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json(
      { plans: buildGuidePlans((data as PlanSettingsRow[]) || []) },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    )
  } catch (error) {
    console.error("[v0] Public guide plans fetch failed:", error)

    return NextResponse.json(
      { plans: buildGuidePlans([]) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    )
  }
}
