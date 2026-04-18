const UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
const UUID_REGEX = new RegExp(`^${UUID_PATTERN}$`)
const UUID_IN_TEXT_REGEX = new RegExp(UUID_PATTERN, "g")

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

export function extractTourIdFromParam(value: string): string | null {
  if (!value) return null
  if (isUuid(value)) return value

  const tail = value.slice(-36)
  if (isUuid(tail)) return tail

  const matches = value.match(UUID_IN_TEXT_REGEX)
  if (!matches || matches.length === 0) return null
  return matches[matches.length - 1]
}

export function slugifyTourTitle(value: string): string {
  return slugifySegment(value, "tour")
}

export function slugifySegment(value: string, fallback = "item"): string {
  if (!value) return fallback

  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized.slice(0, 80) || fallback
}

export function createTourSlugSegment(id: string, title?: string | null): string {
  const slug = slugifyTourTitle(title || "")
  return `${slug}-${id}`
}

export function buildCityToursPath(citySlugOrName: string): string {
  const citySlug = slugifySegment(citySlugOrName, "city")
  return `/tours/${citySlug}`
}

export function buildCanonicalTourPath(citySlugOrName: string, tourSlugOrTitle: string): string {
  const citySlug = slugifySegment(citySlugOrName, "city")
  const tourSlug = slugifySegment(tourSlugOrTitle, "tour")
  return `/tours/${citySlug}/${tourSlug}`
}

// Backward compatible helper:
// - Prefer passing citySlug + tourSlug for canonical /tours/{city}/{tour}
// - Falls back to legacy /tours/{slug}-{uuid} when slugs are unavailable
export function buildTourPath(
  id: string,
  title?: string | null,
  citySlug?: string | null,
  tourSlug?: string | null,
): string {
  if (citySlug && tourSlug) {
    return buildCanonicalTourPath(citySlug, tourSlug)
  }
  return `/tours/${createTourSlugSegment(id, title)}`
}

export function buildTourPathFromRecord(tour: {
  id: string
  title?: string | null
  city?: string | null
  city_slug?: string | null
  tour_slug?: string | null
}): string {
  if (tour.city_slug && tour.tour_slug) {
    return buildCanonicalTourPath(tour.city_slug, tour.tour_slug)
  }
  if (tour.city && tour.tour_slug) {
    return buildCanonicalTourPath(tour.city, tour.tour_slug)
  }
  return buildTourPath(tour.id, tour.title || undefined)
}

export function resolveCitySlug(value: string | null | undefined): string {
  return slugifySegment(value || "", "city")
}

export function resolveTourSlug(value: string | null | undefined): string {
  return slugifySegment(value || "", "tour")
}
