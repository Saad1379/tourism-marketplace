const BRAND_NAME = "TipWalk"
const CANONICAL_ORIGIN = "https://www.tipwalk.com"
const CANONICAL_HOST = "www.tipwalk.com"
const FORBIDDEN_TOKENS = ["touristica", "tourística"]

const DEFAULT_PATHS = [
  "/",
  "/tours/paris",
  "/about",
  "/how-it-works",
  "/become-guide",
  "/faq",
  "/tours/paris/city-of-lights-walking-tour",
  "/tours/paris/montmartre-walking-tour",
]

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeBaseUrl(value) {
  const fallback = CANONICAL_ORIGIN
  const raw = String(value || "").trim() || fallback
  try {
    const parsed = new URL(raw)
    return parsed.origin
  } catch {
    return fallback
  }
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function extractFirst(html, regex) {
  const match = html.match(regex)
  return match ? decodeHtml(match[1]) : null
}

function pushFailure(failures, path, message) {
  failures.push(`[${path}] ${message}`)
}

function normalizeJsonLdNodes(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap((entry) => normalizeJsonLdNodes(entry))
  if (typeof value === "object") return [value]
  return []
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "tipwalk-brand-identity-guard/1.0",
    },
    cache: "no-store",
  })

  const html = await response.text()
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    html,
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BRAND_GUARD_BASE_URL)
  const paths = [...DEFAULT_PATHS, ...parseList(process.env.BRAND_GUARD_EXTRA_PATHS)]
  const failures = []

  for (const path of paths) {
    const routePath = path.startsWith("/") ? path : `/${path}`
    const url = `${baseUrl}${routePath}`

    let payload
    try {
      payload = await fetchHtml(url)
    } catch (error) {
      pushFailure(failures, routePath, `request failed: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    if (!payload.ok) {
      pushFailure(failures, routePath, `expected 200 but got ${payload.status}`)
      continue
    }

    if (!payload.contentType.includes("text/html")) {
      pushFailure(failures, routePath, `expected text/html content-type, got "${payload.contentType}"`)
      continue
    }

    const html = payload.html
    const htmlLower = html.toLowerCase()

    for (const token of FORBIDDEN_TOKENS) {
      if (htmlLower.includes(token.toLowerCase())) {
        pushFailure(failures, routePath, `found forbidden token "${token}" in rendered HTML`)
      }
    }

    const title = extractFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
    if (!title) {
      pushFailure(failures, routePath, "missing <title> tag")
    } else if (!title.includes(BRAND_NAME)) {
      pushFailure(failures, routePath, `title does not include "${BRAND_NAME}"`)
    }

    const canonicalRaw = extractFirst(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    if (!canonicalRaw) {
      pushFailure(failures, routePath, "missing canonical link tag")
    } else {
      let canonical
      try {
        canonical = new URL(canonicalRaw, baseUrl)
      } catch {
        pushFailure(failures, routePath, `invalid canonical URL "${canonicalRaw}"`)
      }

      if (canonical) {
        if (canonical.protocol !== "https:") {
          pushFailure(failures, routePath, `canonical must use https, got "${canonical.protocol}"`)
        }
        if (canonical.hostname !== CANONICAL_HOST) {
          pushFailure(
            failures,
            routePath,
            `canonical host must be "${CANONICAL_HOST}", got "${canonical.hostname}"`,
          )
        }
      }
    }

    const ogSiteName = extractFirst(
      html,
      /<meta[^>]*(?:property|name)=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    )
    if (!ogSiteName) {
      pushFailure(failures, routePath, "missing og:site_name meta tag")
    } else if (ogSiteName !== BRAND_NAME) {
      pushFailure(failures, routePath, `og:site_name must equal "${BRAND_NAME}", got "${ogSiteName}"`)
    }

    const scripts = Array.from(
      html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    )

    const organizationAndWebsiteNodes = []

    for (const [, scriptBody] of scripts) {
      const cleaned = String(scriptBody || "").trim()
      if (!cleaned) continue
      try {
        const parsed = JSON.parse(cleaned)
        const nodes = normalizeJsonLdNodes(parsed)
        for (const node of nodes) {
          const type = String(node?.["@type"] || "")
          if (type === "Organization" || type === "WebSite") {
            organizationAndWebsiteNodes.push(node)
          }
        }
      } catch {
        // Ignore malformed JSON-LD blocks for this guardrail.
      }
    }

    if (organizationAndWebsiteNodes.length === 0) {
      pushFailure(failures, routePath, "missing Organization/WebSite JSON-LD nodes")
    } else {
      for (const node of organizationAndWebsiteNodes) {
        const type = String(node?.["@type"] || "Unknown")
        const name = String(node?.name || "").trim()
        if (name && name !== BRAND_NAME) {
          pushFailure(failures, routePath, `${type} JSON-LD name must be "${BRAND_NAME}", got "${name}"`)
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error("Brand identity guard failed:")
    failures.forEach((item) => console.error(`- ${item}`))
    process.exit(1)
  }

  console.log(`Brand identity guard passed for ${paths.length} public routes.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
