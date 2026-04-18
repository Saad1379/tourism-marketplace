import { toTitleCaseLabel } from "@/lib/seo/metadata"
import { toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"
import { normalizeAddressCountry, truncateDescriptionForSchema } from "@/lib/tours/seo-autogen"
import { getStorageUrl } from "@/lib/utils"

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeComparable(value: string): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function titleize(value: string): string {
  return toTitleCaseLabel(normalizeText(value)) || normalizeText(value)
}

function truncateWordSafe(value: string, maxLength: number): string {
  const text = normalizeText(value)
  if (text.length <= maxLength) return text
  const slice = text.slice(0, maxLength + 1)
  const cut = slice.lastIndexOf(" ")
  if (cut > Math.floor(maxLength * 0.6)) {
    return slice.slice(0, cut).trim()
  }
  return text.slice(0, maxLength).trim()
}

function sanitizeStopNameForMeta(value: string): string {
  const text = normalizeText(value)
  if (!text) return ""
  const bracketIndex = text.search(/[([{]/)
  const beforeBracket = bracketIndex >= 0 ? text.slice(0, bracketIndex) : text
  return beforeBracket.replace(/[\s\-–—,:;]+$/g, "").trim()
}

const PARIS_NEIGHBOURHOOD_LOOKUP: Record<string, string> = {
  montmartre: "Montmartre",
  lemarais: "Le Marais",
  latinquarter: "Latin Quarter",
  saintgermain: "Saint-Germain",
  saintgermaindespres: "Saint-Germain-des-Pres",
  iledelacite: "Ile de la Cite",
  pariscentre: "Paris Centre",
  citycentre: "City Centre",
  citycenter: "City Centre",
}

function cleanTitleCandidate(rawTitle: string, cityLabel: string): string {
  const cityPattern = normalizeText(cityLabel).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return normalizeText(rawTitle)
    .replace(/\bfree\b/gi, "")
    .replace(/\bwalking\s+tour\b/gi, "")
    .replace(/\btour\b/gi, "")
    .replace(new RegExp(`\\bin\\s+${cityPattern}\\b`, "i"), "")
    .replace(/[,:;|]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function cityFromInput(cityValue: string): string {
  return titleize(cityValue || "City")
}

function firstStopCandidate(stops: string[]): string {
  return normalizeText(stops[0] || "")
    .split(",")[0]
    .trim()
}

function normalizeParisNeighbourhood(candidate: string, cityLabel: string): string {
  if (normalizeComparable(cityLabel) !== "paris") return candidate
  const key = normalizeComparable(candidate)
  return PARIS_NEIGHBOURHOOD_LOOKUP[key] || cityLabel
}

function toPossessive(label: string): string {
  const value = normalizeText(label)
  if (!value) return "This"
  return /s$/i.test(value) ? `${value}'` : `${value}'s`
}

export function getOrderedStopNames(tourStops: any[]): string[] {
  if (!Array.isArray(tourStops)) return []
  return [...tourStops]
    .sort((a: any, b: any) => Number(a?.position || 0) - Number(b?.position || 0))
    .map((stop: any) => normalizeText(stop?.stop_name))
    .filter(Boolean)
}

export function deriveTourNeighbourhood(input: {
  tourTitle?: string | null
  city?: string | null
  stopNames?: string[]
}): string {
  const cityLabel = cityFromInput(String(input.city || ""))
  const cleanedTitle = cleanTitleCandidate(String(input.tourTitle || ""), cityLabel)
  const fromTitle =
    cleanedTitle && normalizeComparable(cleanedTitle) !== normalizeComparable(cityLabel) ? cleanedTitle : ""
  const fromStops = firstStopCandidate(Array.isArray(input.stopNames) ? input.stopNames : [])
  const candidate = fromTitle || fromStops || cityLabel
  return normalizeParisNeighbourhood(titleize(candidate), cityLabel)
}

export function buildTourSeoHeading(input: {
  city?: string | null
  tourTitle?: string | null
  stopNames?: string[]
}): {
  cityLabel: string
  neighbourhood: string
  h1: string
  title: string
} {
  const cityLabel = cityFromInput(String(input.city || ""))
  const neighbourhood = deriveTourNeighbourhood({
    city: cityLabel,
    tourTitle: input.tourTitle,
    stopNames: input.stopNames,
  })
  const sameAsCity = normalizeComparable(neighbourhood) === normalizeComparable(cityLabel)
  const h1 = sameAsCity
    ? `Free Walking Tour of ${cityLabel}`
    : `Free Walking Tour of ${neighbourhood}, ${cityLabel}`
  const titleCore = sameAsCity
    ? `Free Walking Tour of ${cityLabel} — Tip at End`
    : `Free Walking Tour of ${neighbourhood} ${cityLabel} — Tip at End`

  return {
    cityLabel,
    neighbourhood,
    h1,
    title: withBrandSuffix(titleCore),
  }
}

export function buildTourSeoMetaDescription(input: {
  neighbourhood: string
  stopNames: string[]
  maxGuests?: number | null
}): string {
  const stops = (Array.isArray(input.stopNames) ? input.stopNames : [])
    .map((name) => sanitizeStopNameForMeta(String(name || "")))
    .filter(Boolean)
    .slice(0, 3)
  const stopText = stops.length > 0 ? stops.join(", ") : "top local landmarks"
  const maxGuests = Math.max(1, Number(input.maxGuests || 1))
  const base = `Explore ${toPossessive(input.neighbourhood)} streets with a local guide — ${stopText} & more. Free to book, tip your guide at the end. Max ${maxGuests} guests.`
  return truncateWordSafe(base, 155)
}

function findNearestFutureScheduleStart(schedules: any[]): string | null {
  const now = Date.now()
  return (Array.isArray(schedules) ? schedules : [])
    .map((schedule: any) => ({
      raw: String(schedule?.start_time || ""),
      time: new Date(String(schedule?.start_time || "")).getTime(),
    }))
    .filter((entry) => Boolean(entry.raw) && Number.isFinite(entry.time) && entry.time > now)
    .sort((a, b) => a.time - b.time)[0]?.raw || null
}

function toAbsoluteSchemaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith("/")) return toCanonicalUrl(url)
  return toCanonicalUrl(`/${url}`)
}

function resolveTourSchemaImageUrl(tour: any): string {
  const rawImage = Array.isArray(tour?.photos) && tour.photos.length > 0
    ? tour.photos[0]
    : Array.isArray(tour?.images) && tour.images.length > 0
      ? tour.images[0]
      : null
  const imagePath = typeof rawImage === "string" ? rawImage : rawImage?.url
  const resolved = normalizeText(getStorageUrl(imagePath))

  if (resolved && resolved !== "/placeholder.svg") {
    return toAbsoluteSchemaUrl(resolved)
  }

  return toCanonicalUrl("/placeholder.jpg")
}

export function buildTourJsonLdSchemas(input: {
  tour: any
  canonicalUrl: string
  cityLabel: string
}): {
  touristAttraction: Record<string, unknown>
  event: Record<string, unknown> | null
} {
  const { tour, canonicalUrl, cityLabel } = input
  const descriptionSnippet = truncateDescriptionForSchema(tour?.description)
  const addressCountry = normalizeAddressCountry(tour?.country)
  const meetingPointName = normalizeText(tour?.meeting_point || "Meeting point shared after booking")
  const availableLanguage =
    Array.isArray(tour?.languages) && tour.languages.length > 0 ? tour.languages : ["English"]
  const maxAttendeeCapacity = Math.max(Number(tour?.max_capacity || 0), 1)
  const nearestFutureStart = findNearestFutureScheduleStart(tour?.tour_schedules)
  const schemaImage = resolveTourSchemaImageUrl(tour)
  const guideName = normalizeText(tour?.guide?.full_name || "TipWalk Guide")
  const durationMinutes = Math.max(15, Number(tour?.duration_minutes || 120))

  const touristAttraction = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: `${normalizeText(tour?.title || "Walking Tour")} in ${cityLabel}`,
    description: descriptionSnippet,
    url: canonicalUrl,
    touristType: "First-time visitors, history lovers, culture travelers",
    availableLanguage,
    location: {
      "@type": "Place",
      name: meetingPointName,
      address: {
        "@type": "PostalAddress",
        addressLocality: cityLabel,
        addressCountry,
      },
    },
  }

  const event = nearestFutureStart
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: normalizeText(tour?.title || "Walking Tour"),
        description: descriptionSnippet,
        url: canonicalUrl,
        image: schemaImage,
        startDate: new Date(nearestFutureStart).toISOString(),
        endDate: new Date(new Date(nearestFutureStart).getTime() + durationMinutes * 60_000).toISOString(),
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        performer: {
          "@type": "Person",
          name: guideName,
        },
        location: {
          "@type": "Place",
          name: meetingPointName,
          address: {
            "@type": "PostalAddress",
            addressLocality: cityLabel,
            addressCountry,
          },
        },
        organizer: {
          "@type": "Person",
          name: guideName,
          // Temporary fallback: use tour canonical URL until a public guide profile route is available.
          url: canonicalUrl,
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          validFrom: new Date().toISOString(),
          url: canonicalUrl,
        },
        maximumAttendeeCapacity: maxAttendeeCapacity,
      }
    : null

  return { touristAttraction, event }
}
