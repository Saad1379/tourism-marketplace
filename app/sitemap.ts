import type { MetadataRoute } from "next"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { buildCanonicalTourPath, buildCityToursPath, resolveCitySlug, resolveTourSlug } from "@/lib/tour-url"
import { getSiteUrl } from "@/lib/site-url"

export const dynamic = "force-dynamic"
const BASE_URL = getSiteUrl()
const STATIC_LAST_MODIFIED = new Date("2026-03-01T00:00:00.000Z")

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static public pages ──────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, priority: 1.0, changeFrequency: "daily" as const },
    { url: `${BASE_URL}/tours`, priority: 0.9, changeFrequency: "daily" as const },
    { url: `${BASE_URL}/become-guide`, priority: 0.8, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/how-it-works`, priority: 0.8, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/about`, priority: 0.7, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/reviews`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${BASE_URL}/faq`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/contact`, priority: 0.5, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/guides/pierre-gendrin`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/guides/charles-afeavo`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/guides/paris/best-neighborhood-walking-routes`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/guides/paris/first-time-free-walking-tour-tips`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/guides/paris/what-to-expect-tip-based-tours`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/cookies`, priority: 0.4, changeFrequency: "yearly" as const },
    { url: `${BASE_URL}/guide-agreement`, priority: 0.4, changeFrequency: "yearly" as const },
    { url: `${BASE_URL}/guide-resources`, priority: 0.5, changeFrequency: "monthly" as const },
    { url: `${BASE_URL}/privacy`, priority: 0.3, changeFrequency: "yearly" as const },
    { url: `${BASE_URL}/terms`, priority: 0.3, changeFrequency: "yearly" as const },
  ].map((route) => ({ ...route, lastModified: STATIC_LAST_MODIFIED }))

  // ── Dynamic tour pages ───────────────────────────────────────────────────
  let tourEntries: MetadataRoute.Sitemap = []
  let cityEntries: MetadataRoute.Sitemap = []
  let blogEntries: MetadataRoute.Sitemap = []

  try {
    const supabase = createServiceRoleClient()

    // Fetch all published, non-deleted tours
    const { data: tours } = await supabase
      .from("tours")
      .select("id, title, updated_at, city, city_slug, tour_slug")
      .eq("status", "published")

    if (tours) {
      tourEntries = tours.map((tour) => ({
        url: `${BASE_URL}${buildCanonicalTourPath(
          tour.city_slug || resolveCitySlug(tour.city || ""),
          tour.tour_slug || resolveTourSlug(tour.title || ""),
        )}`,
        lastModified: tour.updated_at ? new Date(tour.updated_at) : STATIC_LAST_MODIFIED,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }))

      // Derive city filter URLs and use latest tour update per city as lastModified.
      const latestByCity = new Map<string, Date>()
      for (const tour of tours) {
        const city = tour.city_slug || resolveCitySlug(tour.city?.trim() || "")
        if (!city) continue

        const updatedAt = tour.updated_at ? new Date(tour.updated_at) : STATIC_LAST_MODIFIED
        const previous = latestByCity.get(city)
        if (!previous || updatedAt > previous) {
          latestByCity.set(city, updatedAt)
        }
      }

      cityEntries = Array.from(latestByCity.entries()).map(([city, lastModified]) => ({
        url: `${BASE_URL}${buildCityToursPath(city)}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))
    }
  } catch {
    // Ignore tours sitemap failures and continue with remaining entries.
  }

  try {
    const supabase = createServiceRoleClient()
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, published_at, updated_at")
      .eq("status", "published")

    if (posts) {
      blogEntries = posts
        .filter((post) => typeof post.slug === "string" && post.slug.length > 0)
        .map((post) => ({
          url: `${BASE_URL}/blog/${post.slug}`,
          lastModified: post.updated_at
            ? new Date(post.updated_at)
            : post.published_at
              ? new Date(post.published_at)
              : STATIC_LAST_MODIFIED,
          changeFrequency: "weekly" as const,
          priority: 0.65,
        }))
    }
  } catch {
    // Ignore blog sitemap failures (for example before blog table exists).
  }

  return [...staticRoutes, ...cityEntries, ...tourEntries, ...blogEntries]
}
