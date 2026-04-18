const DEFAULT_META_MAX_LENGTH = 160

export function normalizeMetaText(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function toTitleCaseLabel(value: string): string {
  const normalized = normalizeMetaText(String(value || "").replace(/[-_]+/g, " "))
  if (!normalized) return ""
  return normalized
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

function normalizeCityMentions(text: string, cityLabel: string): string {
  if (!text || !cityLabel) return text
  const cityPattern = new RegExp(`\\b${escapeRegExp(cityLabel)}\\b`, "ig")
  return text.replace(cityPattern, cityLabel)
}

export function truncateAtWordBoundary(value: string, maxLength = DEFAULT_META_MAX_LENGTH): string {
  const text = normalizeMetaText(value)
  if (!text) return ""
  if (text.length <= maxLength) return text

  const maxWithoutEllipsis = Math.max(8, maxLength - 3)
  const slice = text.slice(0, maxWithoutEllipsis + 1)
  let cutoff = slice.lastIndexOf(" ")
  if (cutoff < Math.floor(maxWithoutEllipsis * 0.6)) {
    cutoff = maxWithoutEllipsis
  }

  const truncated = text.slice(0, cutoff).trim().replace(/[,\-:;]+$/g, "")
  return `${truncated}...`
}

export function buildCityMetaDescription(cityName: string, sourceDescription?: string | null, maxLength = DEFAULT_META_MAX_LENGTH): string {
  const cityLabel = toTitleCaseLabel(cityName) || cityName
  const fallback = `Discover free walking tours in ${cityLabel} with verified local guides. Reserve free and tip at the end.`
  const source = normalizeMetaText(sourceDescription || "")
  const isWeakSource = source.length < 80
  const baseDescription = isWeakSource ? fallback : normalizeCityMentions(source, cityLabel)
  return truncateAtWordBoundary(baseDescription, maxLength)
}

function formatDuration(durationMinutes?: number | null): string | null {
  if (!Number.isFinite(durationMinutes) || !durationMinutes || durationMinutes <= 0) return null

  if (durationMinutes < 60) return `${Math.round(durationMinutes)} minutes`

  const hours = durationMinutes / 60
  if (Number.isInteger(hours)) {
    return `${hours} hour${hours === 1 ? "" : "s"}`
  }

  return `${hours.toFixed(1)} hours`
}

type BuildTourMetaDescriptionInput = {
  title: string
  city: string
  durationMinutes?: number | null
  languages?: string[] | null
  sourceDescription?: string | null
  maxLength?: number
}

export function buildTourMetaDescription({
  title,
  city,
  durationMinutes,
  languages,
  sourceDescription,
  maxLength = DEFAULT_META_MAX_LENGTH,
}: BuildTourMetaDescriptionInput): string {
  const cityLabel = toTitleCaseLabel(city) || city
  const source = normalizeMetaText(sourceDescription || "")
  const normalizedSource = normalizeCityMentions(source, cityLabel)

  const duration = formatDuration(durationMinutes)
  const primaryLanguage = Array.isArray(languages) && languages.length > 0 ? normalizeMetaText(languages[0] || "") : ""
  const details = [duration, primaryLanguage].filter(Boolean).join(", ")
  const detailSuffix = details ? ` (${details})` : ""

  const fallback = `Book ${title}, a free walking tour in ${cityLabel}${detailSuffix}. Reserve free now and tip your guide at the end of the tour.`
  const baseDescription = normalizedSource.length >= 110 ? normalizedSource : fallback
  return truncateAtWordBoundary(baseDescription, maxLength)
}
