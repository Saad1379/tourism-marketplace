import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { resolveCitySlug } from "@/lib/tour-url"

export async function GET() {
  try {
    try {
      const serviceSupabase = createServiceRoleClient()
      const { data, error } = await serviceSupabase
        .from("cities")
        .select("id, name, country, slug, credits_per_adult")
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (!error && data) {
        return NextResponse.json(
          { cities: data },
          { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
        )
      }
    } catch {
      // Fall through to public tours-based city list.
    }

    const supabase = await createClient()
    const { data: tours, error: toursError } = await supabase
      .from("tours")
      .select("city, country, city_slug")
      .eq("status", "published")
      .limit(5000)

    if (toursError) {
      return NextResponse.json({ cities: [] })
    }

    const cityMap = new Map<string, { id: string; name: string; country: string; slug: string }>()
    for (const row of tours || []) {
      const cityName = String(row.city || "").trim()
      if (!cityName) continue
      const country = String(row.country || "").trim()
      const slug = String(row.city_slug || resolveCitySlug(cityName))
      const key = `${slug}|${country.toLowerCase()}`
      if (!cityMap.has(key)) {
        cityMap.set(key, {
          id: slug,
          name: cityName,
          country,
          slug,
        })
      }
    }

    const fallbackCities = Array.from(cityMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json(
      { cities: fallbackCities },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error", cities: [] },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    )
  }
}
