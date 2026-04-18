export const BRAND_NAME = "TipWalk"
export const BRAND_SITE_URL = "https://www.tipwalk.com"
export const BRAND_SITE_HOST = "www.tipwalk.com"
export const LEGACY_BRAND_TOKENS = ["touristica", "tourística"] as const

export function withBrandSuffix(value: string): string {
  const title = String(value || "").trim()
  if (!title) return BRAND_NAME
  if (title.includes(BRAND_NAME)) return title
  return `${title} | ${BRAND_NAME}`
}

export function toCanonicalUrl(pathname: string = "/"): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  if (path === "/") return `${BRAND_SITE_URL}/`
  return `${BRAND_SITE_URL}${path}`
}
