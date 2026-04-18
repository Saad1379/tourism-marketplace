import { revalidatePath } from "next/cache"
import { buildCanonicalTourPath, buildCityToursPath, resolveCitySlug, resolveTourSlug } from "@/lib/tour-url"

type TourSeoIdentity = {
  city?: string | null
  citySlug?: string | null
  title?: string | null
  tourSlug?: string | null
}

function normalizeCitySlug(identity: TourSeoIdentity): string {
  return String(identity.citySlug || resolveCitySlug(identity.city || "")).trim()
}

function normalizeTourSlug(identity: TourSeoIdentity): string {
  return String(identity.tourSlug || resolveTourSlug(identity.title || "")).trim()
}

export function getSeoPathsForTour(identity: TourSeoIdentity): string[] {
  const citySlug = normalizeCitySlug(identity)
  const tourSlug = normalizeTourSlug(identity)

  const paths = new Set<string>(["/", "/tours", "/sitemap.xml", "/robots.txt"])
  if (citySlug) {
    paths.add(buildCityToursPath(citySlug))
  }
  if (citySlug && tourSlug) {
    paths.add(buildCanonicalTourPath(citySlug, tourSlug))
  }

  if (citySlug === "paris") {
    paths.add("/guides/paris/best-neighborhood-walking-routes")
    paths.add("/guides/paris/first-time-free-walking-tour-tips")
    paths.add("/guides/paris/what-to-expect-tip-based-tours")
  }

  return Array.from(paths)
}

export function revalidateTourSeo(identity: TourSeoIdentity) {
  for (const path of getSeoPathsForTour(identity)) {
    try {
      revalidatePath(path)
    } catch (error) {
      console.error("[v0] SEO revalidation failed:", path, error)
    }
  }
}
