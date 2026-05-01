import { BRAND_SITE_HOST, BRAND_SITE_URL } from "@/lib/seo/brand"

const FALLBACK_SITE_URL = BRAND_SITE_URL

function normalizeTourichoHost(url: URL): URL {
  if (url.hostname === "touricho.com") {
    url.hostname = BRAND_SITE_HOST
  }
  if (url.hostname === BRAND_SITE_HOST && url.protocol !== "https:") {
    url.protocol = "https:"
  }
  return url
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!configured) return FALLBACK_SITE_URL

  try {
    const parsed = normalizeTourichoHost(new URL(configured))
    return parsed.origin
  } catch {
    return FALLBACK_SITE_URL
  }
}
