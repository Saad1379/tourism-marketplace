export const SEO_DESCRIPTION_MIN_CHARS = 1000
export const SEO_HIGHLIGHTS_MIN_COUNT = 3
export const SEO_KEYWORDS_MIN_COUNT = 3

export type SeoQualityInput = {
  description?: string | null
  highlights?: string[] | null
  seoKeywords?: string[] | null
}

export type SeoQualityResult = {
  isPublishReady: boolean
  descriptionLength: number
  highlightCount: number
  keywordCount: number
  issues: string[]
}

export function normalizeSeoKeywords(keywords: string[] | string | null | undefined): string[] {
  const rawList = Array.isArray(keywords)
    ? keywords
    : typeof keywords === "string"
      ? keywords.split(",")
      : []

  const deduped = new Set<string>()
  for (const keyword of rawList) {
    const trimmed = String(keyword || "").trim().toLowerCase()
    if (!trimmed) continue
    deduped.add(trimmed)
  }

  return Array.from(deduped).slice(0, 20)
}

export function evaluatePublishSeoQuality(input: SeoQualityInput): SeoQualityResult {
  const descriptionLength = (input.description || "").trim().length
  const highlightCount = (input.highlights || []).filter((item) => String(item || "").trim().length > 0).length
  const keywordCount = normalizeSeoKeywords(input.seoKeywords || []).length

  const issues: string[] = []
  if (descriptionLength < SEO_DESCRIPTION_MIN_CHARS) {
    issues.push(`Description must be at least ${SEO_DESCRIPTION_MIN_CHARS} characters for publishing.`)
  }
  if (highlightCount < SEO_HIGHLIGHTS_MIN_COUNT) {
    issues.push(`Add at least ${SEO_HIGHLIGHTS_MIN_COUNT} highlights/stops before publishing.`)
  }
  if (keywordCount < SEO_KEYWORDS_MIN_COUNT) {
    issues.push(`Add at least ${SEO_KEYWORDS_MIN_COUNT} SEO keywords before publishing.`)
  }

  return {
    isPublishReady: issues.length === 0,
    descriptionLength,
    highlightCount,
    keywordCount,
    issues,
  }
}
