import { resolveCitySlug, resolveTourSlug } from "@/lib/tour-url"

type SupabaseLike = {
  from: (table: string) => any
}

export type TourSlugPair = {
  citySlug: string
  tourSlug: string
}

function buildUniqueSlug(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base
  let index = 2
  while (existing.has(`${base}-${index}`)) {
    index += 1
  }
  return `${base}-${index}`
}

export async function generateUniqueTourSlugPair(
  supabase: SupabaseLike,
  city: string,
  title: string,
  excludeTourId?: string,
): Promise<TourSlugPair> {
  const citySlug = resolveCitySlug(city)
  const baseTourSlug = resolveTourSlug(title)

  let query = supabase.from("tours").select("id, tour_slug").eq("city_slug", citySlug).limit(5000)
  if (excludeTourId) {
    query = query.neq("id", excludeTourId)
  }

  const { data, error } = await query
  if (error) {
    return { citySlug, tourSlug: baseTourSlug }
  }

  const existing = new Set<string>()
  for (const row of data || []) {
    if (row?.tour_slug) {
      existing.add(String(row.tour_slug))
    }
  }

  return {
    citySlug,
    tourSlug: buildUniqueSlug(baseTourSlug, existing),
  }
}
