const CITY_SLUG_TIMEZONE_MAP: Record<string, string> = {
  amsterdam: "Europe/Amsterdam",
  barcelona: "Europe/Madrid",
  berlin: "Europe/Berlin",
  lisbon: "Europe/Lisbon",
  london: "Europe/London",
  marseille: "Europe/Paris",
  paris: "Europe/Paris",
  prague: "Europe/Prague",
  rome: "Europe/Rome",
}

function normalizeCityKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function resolveTourTimeZone(input: {
  citySlug?: string | null
  city?: string | null
  country?: string | null
}): string {
  const slugKey = normalizeCityKey(input.citySlug || "")
  if (slugKey && CITY_SLUG_TIMEZONE_MAP[slugKey]) {
    return CITY_SLUG_TIMEZONE_MAP[slugKey]
  }

  const cityKey = normalizeCityKey(input.city || "")
  if (cityKey && CITY_SLUG_TIMEZONE_MAP[cityKey]) {
    return CITY_SLUG_TIMEZONE_MAP[cityKey]
  }

  const countryKey = normalizeCityKey(input.country || "")
  if (countryKey === "france") return "Europe/Paris"
  if (countryKey === "italy") return "Europe/Rome"
  if (countryKey === "spain") return "Europe/Madrid"
  if (countryKey === "portugal") return "Europe/Lisbon"
  if (countryKey === "united-kingdom" || countryKey === "uk") return "Europe/London"
  if (countryKey === "germany") return "Europe/Berlin"
  if (countryKey === "netherlands") return "Europe/Amsterdam"
  if (countryKey === "czech-republic" || countryKey === "czechia") return "Europe/Prague"

  return "UTC"
}
