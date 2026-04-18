function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
}

function truncateAtWord(value: string, maxLength: number): string {
  const normalized = normalizeText(value)
  if (normalized.length <= maxLength) return normalized

  const sliced = normalized.slice(0, maxLength + 1)
  const cut = sliced.lastIndexOf(" ")
  if (cut > Math.floor(maxLength * 0.6)) {
    return sliced.slice(0, cut).trim()
  }

  return normalized.slice(0, maxLength).trim()
}

export function getGuideFirstName(fullName: string | null | undefined): string {
  const normalized = normalizeText(fullName)
  if (!normalized) return "your guide"
  return normalized.split(" ")[0] || "your guide"
}

export function deriveNeighbourhood(
  tourTitle: string | null | undefined,
  city: string | null | undefined,
  stopNames: string[],
): string {
  const cityLabel = normalizeText(city)
  const title = normalizeText(tourTitle)

  const cleanedTitle = title
    .replace(/\bfree\b/gi, "")
    .replace(/\bwalking\s+tour\b/gi, "")
    .replace(/\btour\b/gi, "")
    .replace(/\bin\s+[a-z\s-]+$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()

  if (cleanedTitle && cleanedTitle.toLowerCase() !== cityLabel.toLowerCase()) {
    return cleanedTitle
  }

  const stopDerived = stopNames
    .map((name) => normalizeText(name))
    .find((name) => {
      if (!name) return false
      const lower = name.toLowerCase()
      const cityLower = cityLabel.toLowerCase()
      return !cityLower || !lower.includes(cityLower)
    })

  if (stopDerived) {
    return stopDerived.split(",")[0].trim()
  }

  return cityLabel || "city centre"
}

export function buildAutoSeoTitle(input: {
  neighbourhood: string
  city: string
}): string {
  const neighbourhood = normalizeText(input.neighbourhood)
  const city = normalizeText(input.city)

  const base = `${neighbourhood} Walking Tour ${city} — Free, Tip at End`
  if (base.length <= 60) return base

  const compact = `${neighbourhood} Walking Tour ${city}`
  return truncateAtWord(compact, 60)
}

export function buildAutoSeoMetaDescription(input: {
  neighbourhood: string
  guideFirstName: string
  stopNames: string[]
  maxGuests: number
}): string {
  const neighbourhood = normalizeText(input.neighbourhood)
  const guideFirstName = normalizeText(input.guideFirstName) || "your guide"
  const stops = (input.stopNames || [])
    .map((stop) => normalizeText(stop))
    .filter(Boolean)
    .slice(0, 3)

  const stopsPart = stops.length > 0 ? stops.join(", ") : "top local landmarks"
  const base = `Free ${neighbourhood} walking tour with ${guideFirstName} — ${stopsPart}. Max ${Math.max(1, Number(input.maxGuests || 1))} guests. Book free, tip at the end.`
  return truncateAtWord(base, 155)
}

export function truncateDescriptionForSchema(value: string | null | undefined): string {
  return truncateAtWord(normalizeText(value), 150)
}

const COUNTRY_CODE_OVERRIDES: Record<string, string> = {
  france: "FR",
  italy: "IT",
  spain: "ES",
  unitedkingdom: "GB",
  "united kingdom": "GB",
  netherlands: "NL",
  czechrepublic: "CZ",
  "czech republic": "CZ",
  portugal: "PT",
  germany: "DE",
  austria: "AT",
  greece: "GR",
}

export function normalizeAddressCountry(value: string | null | undefined): string {
  const normalized = normalizeText(value)
  if (!normalized) return "FR"

  if (/^[A-Za-z]{2}$/.test(normalized)) {
    return normalized.toUpperCase()
  }

  const key = normalized.toLowerCase()
  return COUNTRY_CODE_OVERRIDES[key] || COUNTRY_CODE_OVERRIDES[key.replace(/\s+/g, "")] || normalized
}
