import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

type Suggestion = {
  city: string
  country: string
  label: string
  score: number
}

function scoreSuggestion(query: string, city: string, country: string) {
  const q = query.toLowerCase()
  const c = city.toLowerCase()
  const countryLower = country.toLowerCase()

  if (c.startsWith(q)) return 3
  if (c.includes(q)) return 2
  if (countryLower.startsWith(q) || countryLower.includes(q)) return 1
  return 0
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = (searchParams.get("q") || "").trim()

    if (query.length < 1) {
      return NextResponse.json({ suggestions: [] })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("tours")
      .select("city, country")
      .eq("status", "published")
      .limit(500)

    if (error) {
      console.error("[v0] Search suggestions error:", error.message)
      return NextResponse.json({ suggestions: [] })
    }

    const deduped = new Map<string, Suggestion>()
    ;(data || []).forEach((row: any) => {
      const city = String(row.city || "").trim()
      if (!city) return
      const country = String(row.country || "").trim()
      const score = scoreSuggestion(query, city, country)
      if (score <= 0) return

      const key = `${city.toLowerCase()}|${country.toLowerCase()}`
      const existing = deduped.get(key)
      if (!existing || score > existing.score) {
        deduped.set(key, {
          city,
          country,
          label: country ? `${city}, ${country}` : city,
          score,
        })
      }
    })

    const suggestions = Array.from(deduped.values())
      .sort((a, b) => b.score - a.score || a.city.localeCompare(b.city))
      .slice(0, 8)
      .map(({ city, country, label }) => ({ city, country, label }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("[v0] Search suggestions server error:", error)
    return NextResponse.json({ suggestions: [] })
  }
}
