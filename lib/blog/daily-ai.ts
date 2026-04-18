import { buildCanonicalTourPath, resolveCitySlug, resolveTourSlug } from "@/lib/tour-url"

type ServiceSupabase = {
  from: (table: string) => any
  storage: any
}

type TourSeedRow = {
  id: string
  title: string | null
  description: string | null
  city: string | null
  city_slug: string | null
  tour_slug: string | null
  highlights: string[] | null
  seo_keywords: string[] | null
  categories: string[] | null
  photos: unknown
  images: unknown
}

type TourSeed = {
  id: string
  title: string
  description: string
  highlights: string[]
  seoKeywords: string[]
  categories: string[]
  imageUrls: string[]
  canonicalPath: string
  canonicalUrl: string
}

type BlogSeedRow = {
  slug: string | null
  hero_image_url: string | null
  infographic_image_url: string | null
}

type RawGeneratedDraft = {
  title?: unknown
  slug?: unknown
  meta_description?: unknown
  content_markdown?: unknown
  content_html?: unknown
  primary_keyword?: unknown
  secondary_keywords?: unknown
  long_tail_keywords?: unknown
  faq_schema?: unknown
}

type FaqItem = {
  question: string
  answer: string
}

type PromptContext = {
  topic: string
  primaryKeyword: string
  secondaryKeywords: string[]
  longTailQuestions: string[]
  specificStops: string[]
  bannedPromptPhrases: string[]
  customInstructions: string
  primaryTourTitle: string
  primaryTourHeroImageUrl: string | null
  tourPages: string[]
  blogPages: string[]
  imageUrls: string[]
  allowedPaths: string[]
}

export type BlogGenerationOverrides = {
  topic?: string
  primaryKeyword?: string
  secondaryKeywords?: string[]
  longTailQuestions?: string[]
  customInstructions?: string
}

export type GeneratedDraft = {
  title: string
  slug: string
  metaDescription: string
  contentMarkdown: string
  contentHtml: string
  primaryKeyword: string
  secondaryKeywords: string[]
  longTailKeywords: string[]
  faqSchema: FaqItem[] | null
  wordCount: number
  internalLinks: string[]
  heroImageUrlCandidate: string | null
  heroImageAltCandidate: string
  generationTopic: string
}

export type GeneratedMediaAssets = {
  heroImageUrl: string
  heroImageAlt: string
  infographicImageUrl: string | null
}

type BannedPhraseMatch = {
  phrase: string
  scope: "anywhere" | "first_100_chars"
  index: number
  matchedText: string
}

type BannedPhraseRule = {
  phrase: string
  scope: "anywhere" | "first_100_chars"
  mode: "phrase" | "regex"
  value: string | RegExp
}

export type BannedPhraseGateResult = {
  failed: boolean
  scannedField: "content_markdown" | "content_html"
  scannedLength: number
  matches: BannedPhraseMatch[]
}

export type BannedPhraseGateFailure = {
  note: string
  title: string
  slugCandidate: string
  metaDescription: string
  contentMarkdown: string
  contentHtml: string
  primaryKeyword: string
  secondaryKeywords: string[]
  longTailKeywords: string[]
  faqSchema: FaqItem[] | null
  wordCount: number
  matchedInternalLinks: string[]
  gateResult: BannedPhraseGateResult
  matches: BannedPhraseMatch[]
}

type BannedPhraseGateError = Error & {
  code: "QUALITY_GATE_BANNED_PHRASES"
  details: BannedPhraseGateFailure
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations"
const DAILY_EVENT = "ai.daily.generated"
const MAX_LINKS_IN_PROMPT = 10
const MAX_BLOG_LINKS_IN_PROMPT = 20
const MAX_IMAGES_IN_PROMPT = 24
const BLOG_MEDIA_BUCKET = process.env.AUTOSEO_STORAGE_BUCKET || "blog-media"
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MIN_WORDS = 1200
const EXPANSION_TARGET_WORDS = 1400
const INFOGRAPHIC_STORAGE_BUCKET = "tour-images"
const INFOGRAPHIC_STORAGE_PREFIX = "blog/infographics"
const REQUIRED_PARIS_TOURS_URL = "https://www.tipwalk.com/tours/paris" as const
const REQUIRED_TOUR_URLS = [
  "https://www.tipwalk.com/tours/paris/montmartre-walking-tour",
  "https://www.tipwalk.com/tours/paris/city-of-lights-walking-tour",
] as const
const BANNED_PHRASE_RULES: BannedPhraseRule[] = [
  { phrase: "dream destination", scope: "anywhere", mode: "phrase", value: "dream destination" },
  { phrase: "rich history", scope: "anywhere", mode: "phrase", value: "rich history" },
  { phrase: "vibrant culture", scope: "anywhere", mode: "phrase", value: "vibrant culture" },
  { phrase: "often referred to as", scope: "anywhere", mode: "phrase", value: "often referred to as" },
  { phrase: "unforgettable experience", scope: "anywhere", mode: "phrase", value: "unforgettable experience" },
  { phrase: "stunning architecture", scope: "anywhere", mode: "phrase", value: "stunning architecture" },
  { phrase: "enchanting city", scope: "anywhere", mode: "phrase", value: "enchanting city" },
  { phrase: "wear comfortable shoes", scope: "anywhere", mode: "phrase", value: "wear comfortable shoes" },
  { phrase: "stay hydrated", scope: "anywhere", mode: "phrase", value: "stay hydrated" },
  { phrase: "a must-see", scope: "anywhere", mode: "phrase", value: "a must-see" },
  { phrase: "hidden gem", scope: "anywhere", mode: "phrase", value: "hidden gem" },
  { phrase: "world-famous", scope: "anywhere", mode: "phrase", value: "world-famous" },
  { phrase: "iconic landmark", scope: "anywhere", mode: "phrase", value: "iconic landmark" },
  { phrase: "steeped in history", scope: "anywhere", mode: "phrase", value: "steeped in history" },
  { phrase: "picturesque", scope: "anywhere", mode: "phrase", value: "picturesque" },
  { phrase: "quaint", scope: "anywhere", mode: "phrase", value: "quaint" },
  { phrase: "breathtaking", scope: "anywhere", mode: "phrase", value: "breathtaking" },
  { phrase: "locals and tourists alike", scope: "anywhere", mode: "phrase", value: "locals and tourists alike" },
  { phrase: "off the beaten path", scope: "anywhere", mode: "phrase", value: "off the beaten path" },
  { phrase: "treasure trove", scope: "anywhere", mode: "phrase", value: "treasure trove" },
  { phrase: "makes Paris so special", scope: "anywhere", mode: "phrase", value: "makes paris so special" },
  { phrase: "lasting memories", scope: "anywhere", mode: "phrase", value: "lasting memories" },
  { phrase: "immerse yourself", scope: "anywhere", mode: "phrase", value: "immerse yourself" },
  // "stunning" used as adjective before a noun.
  { phrase: "stunning [noun]", scope: "anywhere", mode: "regex", value: /\bstunning\s+[a-z][a-z'-]*\b/gi },
  { phrase: "City of Lights", scope: "first_100_chars", mode: "phrase", value: "city of lights" },
]
const PROMPT_BANNED_PHRASES = [
  "dream destination",
  "rich history",
  "vibrant culture",
  "often referred to as",
  "unforgettable experience",
  "stunning architecture",
  "enchanting city",
  "wear comfortable shoes",
  "stay hydrated",
  "a must-see",
  "hidden gem",
  "world-famous",
  "iconic landmark",
  "steeped in history",
  "picturesque",
  "quaint",
  "breathtaking",
  "stunning [noun]",
  "locals and tourists alike",
  "off the beaten path",
  "treasure trove",
  "makes Paris so special",
  "lasting memories",
  "immerse yourself",
  "City of Lights (as an opener)",
]
export const BANNED_GENERIC_PHRASES_NOTE = "Banned generic phrases detected — regenerate."
const HARD_CONSTRAINT_BANNED_PHRASES_PROMPT_BLOCK = `HARD CONSTRAINT — you must not use any of these words or phrases anywhere in your response. If you catch yourself about to write one, delete it and use a specific fact, name, or observation instead:

hidden gem, hidden gems, breathtaking, stunning [adjective before noun], off the beaten path, dream destination, rich history, vibrant culture, often referred to as, unforgettable experience, stunning architecture, enchanting city, wear comfortable shoes, stay hydrated, a must-see, world-famous, iconic landmark, steeped in history, picturesque, quaint, locals and tourists alike, treasure trove, lasting memories, immerse yourself, makes Paris so special, City of Lights [in opening], vibrant atmosphere, charming streets, cobblestone streets, a unique perspective, delve deeper, rich tapestry, nestled, boasts, lively, timeless, majestic`

const DAILY_AI_SYSTEM_PROMPT = `You are a content writer for TipWalk.com — a free walking tour marketplace in Paris where local guides lead small groups of maximum 10 guests. Guides keep 100% of their tips. Booking is always free.
Our guides:

Pierre Gendrin — Montmartre, 8 years living in the neighbourhood, 12 five-star reviews
Charles Afeavo — City of Lights (Pont Neuf, Notre-Dame, Île de la Cité), 5-star rated

Our tone: Honest, local, conversational. Like a knowledgeable Parisian friend giving real advice — not a travel brochure, not a tourism board, not a generic blog.
Hard rules — never break these:

Never open with "Paris is known as..." or "Paris, often referred to as..." or any variation
Never use: "dream destination", "rich history", "vibrant culture", "enchanting", "unforgettable experience", "City of Lights" as an opener, "stunning architecture", "breathtaking views" as standalone phrases
Never write bullet lists of obvious travel tips (wear comfortable shoes, stay hydrated, learn French phrases)
Never pad to hit word count — every paragraph must add new information
Never write in passive voice — write actively and directly
Never cover multiple topics shallowly — go deep on one specific topic
Never hallucinate TipWalk features, prices, or tour details not provided above

What good TipWalk content looks like:

Opens with a specific, surprising, or useful fact — not a generic intro
References Pierre or Charles by name where relevant
Mentions real Montmartre stops: Moulin Rouge, Sacré-Coeur, Moulin de la Galette, Le Bateau Lavoir, the secret vineyard, I Love You Wall, Place du Tertre
Mentions real City of Lights stops: Pont Neuf, Notre-Dame, Île de la Cité, Sainte-Chapelle, Point Zéro
Sounds like it was written by someone who has actually walked these streets
Gives advice that travellers can't find on the first page of Google
Ends with a natural, non-pushy CTA linking to the most relevant tour page

Structure every post as:

Strong opening — one paragraph, specific and surprising, answers the keyword question immediately
Body sections (H2s) — each one goes deep on a specific sub-topic, 150–200 words per section
TipWalk angle — one section that naturally connects the topic to what TipWalk offers, using Pierre or Charles by name
FAQ — 3–5 questions that real TipWalk guests actually ask, with specific honest answers
CTA — one sentence, natural, links to the most relevant tour page

Inject these facts into every post where relevant:

TipWalk tours: free to book, max 10 guests, tip at end (typical €10–20)
Pierre's Montmartre tour starts at Place Blanche (Moulin Rouge), 2 hours, English and French
Charles's City of Lights tour covers Pont Neuf area, 2.5 hours, English
TipWalk launched in Paris in March 2026
Both guides are PRO verified with 5.0★ ratings

${HARD_CONSTRAINT_BANNED_PHRASES_PROMPT_BLOCK}`

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function normalizeMultiLineText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeHttpUrl(value: unknown): string | null {
  const candidate = normalizeText(value)
  if (!candidate) return null
  if (!/^https?:\/\//i.test(candidate)) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

function normalizeHttpUrlArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const urls: string[] = []
  for (const entry of value) {
    const url = normalizeHttpUrl(entry)
    if (url) urls.push(url)
  }
  return urls
}

function dedupeTrimmed(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const raw of values) {
    const value = normalizeText(raw)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(value)
    if (output.length >= limit) break
  }

  return output
}

function resolveBlogModel(): string {
  const fallback = "gpt-4o"
  const requested = normalizeText(process.env.OPENAI_BLOG_MODEL)
  if (!requested) return fallback

  const lower = requested.toLowerCase()
  const allowed = lower.startsWith("gpt-4") || lower.startsWith("gpt-5") || lower.startsWith("o1") || lower.startsWith("o3")
  if (allowed) return requested

  console.warn(`[daily-ai-blog] Ignoring unsupported OPENAI_BLOG_MODEL="${requested}". Falling back to ${fallback}.`)
  return fallback
}

function extractStopCandidatesFromTours(tours: TourSeed[]): string[] {
  const raw = tours.flatMap((tour) => (Array.isArray(tour.highlights) ? tour.highlights : []))
  const splitCandidates = raw.flatMap((entry) => entry.split(/[,;|•]/g))
  const cleaned = splitCandidates
    .map((value) => normalizeText(value))
    .map((value) => value.replace(/^[-–—\d.\s]+/, "").trim())
    .filter((value) => value.length >= 3 && value.length <= 72)
    .filter((value) => !/^(tip|tips|small group|max guests|book free|free booking)$/i.test(value))

  return dedupeTrimmed(cleaned, 18)
}

function normalizeOverrideList(
  input: string[] | undefined,
  options: { maxItems: number; maxLength: number },
): string[] {
  if (!Array.isArray(input)) return []
  const normalized = dedupeTrimmed(input.map((entry) => normalizeText(entry)), options.maxItems)
  return normalized.map((entry) => truncateText(entry, options.maxLength))
}

function normalizeCustomInstructions(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.replace(/\r\n/g, "\n").trim().slice(0, 2000)
}

function truncateText(value: string, maxLength: number): string {
  const text = value.trim()
  if (text.length <= maxLength) return text
  const preview = text.slice(0, maxLength + 1)
  const cut = preview.lastIndexOf(" ")
  if (cut > Math.floor(maxLength * 0.6)) return preview.slice(0, cut).trim()
  return text.slice(0, maxLength).trim()
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function convertInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text)

  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
}

function markdownToHtml(markdown: string): string {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())

  const parts: string[] = []
  let inUnorderedList = false
  let inOrderedList = false

  const closeLists = () => {
    if (inUnorderedList) {
      parts.push("</ul>")
      inUnorderedList = false
    }
    if (inOrderedList) {
      parts.push("</ol>")
      inOrderedList = false
    }
  }

  for (const line of lines) {
    if (!line) {
      closeLists()
      continue
    }

    if (/^#{1,3}\s+/.test(line)) {
      closeLists()
      const level = Math.min(3, Math.max(1, line.match(/^#+/)?.[0].length || 1))
      const text = line.replace(/^#{1,3}\s+/, "")
      parts.push(`<h${level}>${convertInlineMarkdown(text)}</h${level}>`)
      continue
    }

    if (/^- /.test(line)) {
      if (inOrderedList) {
        parts.push("</ol>")
        inOrderedList = false
      }
      if (!inUnorderedList) {
        parts.push("<ul>")
        inUnorderedList = true
      }
      parts.push(`<li>${convertInlineMarkdown(line.replace(/^- /, ""))}</li>`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      if (inUnorderedList) {
        parts.push("</ul>")
        inUnorderedList = false
      }
      if (!inOrderedList) {
        parts.push("<ol>")
        inOrderedList = true
      }
      parts.push(`<li>${convertInlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>`)
      continue
    }

    closeLists()
    parts.push(`<p>${convertInlineMarkdown(line)}</p>`)
  }

  closeLists()
  return parts.join("\n")
}

async function ensureBucketExists(supabase: ServiceSupabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) {
    throw new Error(`Unable to list storage buckets: ${error.message}`)
  }

  if (buckets?.some((bucket: { id: string }) => bucket.id === BLOG_MEDIA_BUCKET)) {
    return
  }

  const { error: createError } = await supabase.storage.createBucket(BLOG_MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: ["image/png", "image/webp", "image/jpeg", "image/svg+xml"],
  })

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(`Unable to create storage bucket "${BLOG_MEDIA_BUCKET}": ${createError.message}`)
  }
}

function buildSvgHeroFallback(title: string): string {
  const safeTitle = escapeHtml(truncateText(title, 110))
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="heroGradient" x1="0" y1="0" x2="1600" y2="900" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0B3B68"/>
      <stop offset="1" stop-color="#E76F51"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#heroGradient)"/>
  <circle cx="1320" cy="220" r="280" fill="#FFFFFF" fill-opacity="0.08"/>
  <circle cx="300" cy="760" r="320" fill="#FFFFFF" fill-opacity="0.08"/>
  <rect x="110" y="180" width="1380" height="540" rx="28" fill="#0F172A" fill-opacity="0.38"/>
  <text x="170" y="305" fill="#F8FAFC" font-family="Georgia, serif" font-size="42" font-weight="700">TipWalk Paris Guide</text>
  <text x="170" y="395" fill="#E2E8F0" font-family="Arial, sans-serif" font-size="56" font-weight="700">${safeTitle}</text>
  <text x="170" y="500" fill="#CBD5E1" font-family="Arial, sans-serif" font-size="30">Local walking routes, practical tips, and neighborhood insights</text>
  <text x="170" y="622" fill="#F8FAFC" font-family="Arial, sans-serif" font-size="30">www.tipwalk.com</text>
</svg>`
}

function buildSvgInfographic(title: string, primaryKeyword: string, secondaryKeywords: string[]): string {
  const safeTitle = escapeHtml(truncateText(title, 80))
  const safePrimary = escapeHtml(truncateText(primaryKeyword, 80))
  const points = secondaryKeywords.slice(0, 4).map((keyword) => escapeHtml(truncateText(keyword, 44)))
  const rows = points
    .map((point, index) => {
      const y = 250 + index * 120
      return `<circle cx="132" cy="${y - 12}" r="10" fill="#0EA5E9"/><text x="162" y="${y}" fill="#0F172A" font-family="Arial, sans-serif" font-size="36">${point}</text>`
    })
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1400" height="1800" viewBox="0 0 1400 1800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1400" height="1800" fill="#F8FAFC"/>
  <rect x="58" y="58" width="1284" height="1684" rx="32" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="4"/>
  <text x="110" y="170" fill="#0F172A" font-family="Georgia, serif" font-size="54" font-weight="700">${safeTitle}</text>
  <text x="110" y="235" fill="#475569" font-family="Arial, sans-serif" font-size="34">Primary keyword: ${safePrimary}</text>
  <line x1="108" y1="300" x2="1292" y2="300" stroke="#E2E8F0" stroke-width="4"/>
  ${rows}
  <rect x="106" y="840" width="1188" height="828" rx="24" fill="#EEF2FF"/>
  <text x="156" y="930" fill="#1E293B" font-family="Arial, sans-serif" font-size="42" font-weight="700">Why this article is useful</text>
  <text x="156" y="1010" fill="#334155" font-family="Arial, sans-serif" font-size="34">- Local context from active Paris walking tours</text>
  <text x="156" y="1090" fill="#334155" font-family="Arial, sans-serif" font-size="34">- Real route and planning insights</text>
  <text x="156" y="1170" fill="#334155" font-family="Arial, sans-serif" font-size="34">- Clear recommendations for first-time visitors</text>
  <text x="156" y="1465" fill="#0F172A" font-family="Arial, sans-serif" font-size="36">TipWalk Blog • www.tipwalk.com</text>
</svg>`
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

async function generateHeroImageBuffer(title: string, primaryKeyword: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING")
  }

  const model = process.env.OPENAI_BLOG_IMAGE_MODEL?.trim() || "gpt-image-1"
  const prompt = [
    "Photorealistic editorial travel hero image for a Paris walking tour blog article.",
    "Scene: Paris street-level perspective, subtle morning light, authentic architecture.",
    "No text, no logos, no watermarks, no people facing the camera.",
    "Mood: premium travel magazine cover.",
    `Article theme: ${title}.`,
    `Keyword anchor: ${primaryKeyword}.`,
  ].join(" ")

  const response = await fetch(OPENAI_IMAGE_GENERATIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: "1536x1024",
      response_format: "b64_json",
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`OPENAI_IMAGE_REQUEST_FAILED: ${response.status} ${payload}`)
  }

  const payload = await response.json()
  const b64 = payload?.data?.[0]?.b64_json
  if (typeof b64 !== "string" || !b64.trim()) {
    throw new Error("OPENAI_IMAGE_EMPTY_RESPONSE")
  }

  const buffer = Buffer.from(b64, "base64")
  if (!buffer.length) {
    throw new Error("OPENAI_IMAGE_EMPTY_BUFFER")
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("OPENAI_IMAGE_TOO_LARGE")
  }

  return buffer
}

async function generateInfographicImageUrlFromDalle(options: {
  title: string
  primaryKeyword: string
  secondaryKeywords: string[]
  longTailKeywords: string[]
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING")
  }

  const { title, primaryKeyword, secondaryKeywords, longTailKeywords } = options
  const keyFacts = dedupeTrimmed(
    [primaryKeyword, ...secondaryKeywords, ...longTailKeywords].map((entry) => normalizeText(entry)),
    3,
  )
  const factsLine = keyFacts.length > 0 ? keyFacts.join(" | ") : `Paris walking tour tips | ${primaryKeyword} | local guide insights`
  const prompt = [
    `Clean, minimal infographic about "${title}" for a Paris walking tour website.`,
    "White background.",
    "TipWalk brand colour #E05C3A as accent.",
    `Include 3 key facts from the article as text labels: ${factsLine}.`,
    "Professional travel editorial style.",
    "No people.",
    "No watermarks.",
    "1792x1024.",
  ]
    .filter(Boolean)
    .join(" ")

  const response = await fetch(OPENAI_IMAGE_GENERATIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      size: "1792x1024",
      quality: "standard",
      n: 1,
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`OPENAI_DALLE_INFOGRAPHIC_REQUEST_FAILED: ${response.status} ${payload}`)
  }

  const payload = await response.json()
  const generatedUrl = normalizeHttpUrl(payload?.data?.[0]?.url)
  if (!generatedUrl) {
    throw new Error("OPENAI_DALLE_INFOGRAPHIC_EMPTY_URL")
  }

  return generatedUrl
}

async function uploadInfographicImageFromRemoteUrl(options: {
  supabase: ServiceSupabase
  slug: string
  remoteImageUrl: string
}): Promise<string> {
  const { supabase, slug, remoteImageUrl } = options
  const response = await fetch(remoteImageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download generated infographic: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (!buffer.length) {
    throw new Error("Generated infographic download is empty")
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Generated infographic exceeds max size limit")
  }

  const safeSlug = toSlug(slug) || `post-${Date.now()}`
  const objectPath = `${INFOGRAPHIC_STORAGE_PREFIX}/${safeSlug}-infographic.png`
  const { error: uploadError } = await supabase.storage
    .from(INFOGRAPHIC_STORAGE_BUCKET)
    .upload(objectPath, buffer, { contentType: "image/png", upsert: true })

  if (uploadError) {
    throw new Error(`Failed to upload infographic image: ${uploadError.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(INFOGRAPHIC_STORAGE_BUCKET).getPublicUrl(objectPath)

  if (!normalizeHttpUrl(publicUrl)) {
    throw new Error("Failed to resolve infographic public URL")
  }

  return publicUrl
}

async function uploadPublicImageBuffer(options: {
  supabase: ServiceSupabase
  articleId: number
  slug: string
  kind: "hero" | "infographic"
  buffer: Buffer
  extension: "png" | "svg"
  contentType: string
}): Promise<string> {
  const { supabase, articleId, slug, kind, buffer, extension, contentType } = options
  const safeSlug = toSlug(slug) || `post-${articleId}`
  const objectPath = `daily-ai/${articleId}/${safeSlug}-${kind}-${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BLOG_MEDIA_BUCKET)
    .upload(objectPath, buffer, { upsert: true, contentType })

  if (uploadError) {
    throw new Error(`Failed to upload ${kind} image: ${uploadError.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BLOG_MEDIA_BUCKET).getPublicUrl(objectPath)

  return publicUrl
}

function cleanMarkdownForWordCount(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function countWords(value: string): number {
  const cleaned = cleanMarkdownForWordCount(value)
  if (!cleaned) return 0
  return cleaned.split(" ").filter(Boolean).length
}

function normalizeKeywordArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const keywords: string[] = []

  for (const entry of value) {
    const keyword = normalizeText(entry)
    if (!keyword) continue
    const dedupeKey = keyword.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    keywords.push(keyword.slice(0, 120))
    if (keywords.length >= limit) break
  }

  return keywords
}

function normalizeFaqSchema(value: unknown): FaqItem[] | null {
  if (!Array.isArray(value)) return null

  const items: FaqItem[] = []
  for (const item of value as Array<Record<string, unknown>>) {
    const question = normalizeText(item?.question)
    const answer = normalizeText(item?.answer)
    if (!question || !answer) continue
    items.push({ question, answer })
  }

  return items.length > 0 ? items : null
}

function getParisDateKey(referenceDate = new Date()): string {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate)

  return formatted
}

function getTopicSeed(parisDateKey: string): number {
  const digits = parisDateKey.replace(/-/g, "")
  const numeric = Number.parseInt(digits, 10)
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  return Date.now()
}

async function fetchPublishedParisTours(supabase: ServiceSupabase, siteUrl: string): Promise<TourSeed[]> {
  const baseQuery = () =>
    supabase
      .from("tours")
      .select("id, title, description, city, city_slug, tour_slug, highlights, seo_keywords, categories, photos, images")
      .eq("status", "published")
      .limit(30)

  const primaryResult = await baseQuery().eq("city_slug", "paris")

  let rows = (Array.isArray(primaryResult.data) ? primaryResult.data : []) as TourSeedRow[]
  if (!rows.length) {
    const fallbackResult = await baseQuery().ilike("city", "paris")
    rows = (Array.isArray(fallbackResult.data) ? fallbackResult.data : []) as TourSeedRow[]
  }

  return rows
    .map((row) => {
      const title = normalizeText(row.title)
      if (!title) return null

      const citySlug = normalizeText(row.city_slug) || resolveCitySlug(normalizeText(row.city) || "paris")
      const tourSlug = normalizeText(row.tour_slug) || resolveTourSlug(title)
      if (!citySlug || !tourSlug) return null

      const canonicalPath = buildCanonicalTourPath(citySlug, tourSlug)
      return {
        id: row.id,
        title,
        description: normalizeText(row.description),
        highlights: Array.isArray(row.highlights) ? row.highlights.map((x) => normalizeText(x)).filter(Boolean) : [],
        seoKeywords: Array.isArray(row.seo_keywords) ? row.seo_keywords.map((x) => normalizeText(x)).filter(Boolean) : [],
        categories: Array.isArray(row.categories) ? row.categories.map((x) => normalizeText(x)).filter(Boolean) : [],
        imageUrls: dedupeTrimmed(
          [...normalizeHttpUrlArray(row.photos), ...normalizeHttpUrlArray(row.images)],
          MAX_IMAGES_IN_PROMPT,
        ),
        canonicalPath,
        canonicalUrl: `${siteUrl}${canonicalPath}`,
      } as TourSeed
    })
    .filter((row): row is TourSeed => Boolean(row))
}

async function fetchPublishedBlogSeed(supabase: ServiceSupabase): Promise<{ blogPages: string[]; imageUrls: string[] }> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, hero_image_url, infographic_image_url")
    .eq("status", "published")
    .limit(120)

  if (error) {
    throw new Error(`Unable to load published blog pages for prompt context: ${error.message}`)
  }

  const rows = (Array.isArray(data) ? data : []) as BlogSeedRow[]
  const blogPages: string[] = []
  const imageUrls: string[] = []

  for (const row of rows) {
    const slug = toSlug(normalizeText(row.slug))
    if (slug) blogPages.push(`/blog/${slug}`)

    const heroImage = normalizeHttpUrl(row.hero_image_url)
    const infographicImage = normalizeHttpUrl(row.infographic_image_url)
    if (heroImage) imageUrls.push(heroImage)
    if (infographicImage) imageUrls.push(infographicImage)
  }

  return {
    blogPages: dedupeTrimmed(blogPages, MAX_BLOG_LINKS_IN_PROMPT),
    imageUrls: dedupeTrimmed(imageUrls, MAX_IMAGES_IN_PROMPT),
  }
}

function buildPromptKeywordPack(options: {
  primaryTour: TourSeed
  tours: TourSeed[]
  angle: string
  overrides?: BlogGenerationOverrides
}): Pick<PromptContext, "topic" | "primaryKeyword" | "secondaryKeywords" | "longTailQuestions"> {
  const { primaryTour, tours, angle, overrides } = options
  const topicCandidates = dedupeTrimmed(
    [
      ...primaryTour.seoKeywords,
      ...primaryTour.categories.map((category) => `${category} paris walking tour`),
      `${primaryTour.title} walking tour tips`,
      `paris walking tour ${angle}`,
      "free walking tour paris tips",
    ],
    24,
  )

  const defaultTopic = topicCandidates[0] || `${primaryTour.title} walking tour in paris`
  const overrideTopic = truncateText(normalizeText(overrides?.topic), 120)
  const topic = overrideTopic || defaultTopic
  const overridePrimaryKeyword = truncateText(normalizeText(overrides?.primaryKeyword), 120)
  const primaryKeyword = overridePrimaryKeyword || topic

  const secondaryPool = dedupeTrimmed(
    [
      ...primaryTour.seoKeywords.slice(1),
      ...tours.flatMap((tour) => tour.seoKeywords),
      ...tours.map((tour) => `${tour.title} paris`),
      "small group walking tour paris",
      "montmartre walking tour tips",
      "notre dame walking tour route",
      "paris local guide advice",
      "free walking tours paris",
    ],
    80,
  )

  const overrideSecondary = normalizeOverrideList(overrides?.secondaryKeywords, {
    maxItems: 5,
    maxLength: 120,
  }).filter((keyword) => keyword.toLowerCase() !== primaryKeyword.toLowerCase())

  const fallbackSecondary = secondaryPool
    .filter((keyword) => keyword.toLowerCase() !== primaryKeyword.toLowerCase())
    .map((keyword) => truncateText(keyword, 120))
  const secondaryKeywords = dedupeTrimmed([...overrideSecondary, ...fallbackSecondary], 5)

  while (secondaryKeywords.length < 5) {
    secondaryKeywords.push(`paris walking tour advice ${secondaryKeywords.length + 1}`)
  }

  const fallbackLongTail = dedupeTrimmed(
    [
      `What is the best time to do ${topic} in Paris?`,
      `How much should you tip on ${primaryTour.title} in Paris?`,
      `Which stops are unmissable on ${primaryTour.title}?`,
      `Is ${topic} worth it for first-time visitors to Paris?`,
      `How can you avoid tourist traps while doing ${topic}?`,
    ],
    3,
  )

  const overrideLongTail = normalizeOverrideList(overrides?.longTailQuestions, {
    maxItems: 3,
    maxLength: 160,
  })
  const longTailQuestions = dedupeTrimmed([...overrideLongTail, ...fallbackLongTail], 3)

  while (longTailQuestions.length < 3) {
    longTailQuestions.push(`What should first-time visitors know about ${topic}?`)
  }

  return {
    topic: truncateText(topic, 120),
    primaryKeyword: truncateText(primaryKeyword, 120),
    secondaryKeywords: secondaryKeywords.map((keyword) => truncateText(keyword, 120)),
    longTailQuestions: longTailQuestions.map((question) => truncateText(question, 160)),
  }
}

function buildTopicContext(options: {
  tours: TourSeed[]
  blogPages: string[]
  imageUrlsFromDb: string[]
  parisDateKey: string
  overrides?: BlogGenerationOverrides
}): PromptContext {
  const { tours, blogPages, imageUrlsFromDb, parisDateKey, overrides } = options
  const seed = getTopicSeed(parisDateKey)
  const primaryTour = tours[seed % tours.length]
  const ordered = [...tours]
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, MAX_LINKS_IN_PROMPT)

  const topicAngles = [
    "first-time traveler planning",
    "best neighborhood stories and route strategy",
    "family-friendly Paris walking tips",
    "food and culture balance on walking routes",
    "photo spots and hidden viewpoints",
    "budget planning and tip expectations",
    "rainy day alternatives and pacing",
  ]

  const angle = topicAngles[seed % topicAngles.length]
  const keywordPack = buildPromptKeywordPack({ primaryTour, tours, angle, overrides })
  const tourPages = dedupeTrimmed([REQUIRED_PARIS_TOURS_URL, ...ordered.map((tour) => tour.canonicalUrl)], MAX_LINKS_IN_PROMPT)
  const specificStops = extractStopCandidatesFromTours(ordered)
  const imageUrls = dedupeTrimmed(
    [...imageUrlsFromDb, ...ordered.flatMap((tour) => tour.imageUrls)],
    MAX_IMAGES_IN_PROMPT,
  )

  return {
    ...keywordPack,
    specificStops,
    bannedPromptPhrases: [...PROMPT_BANNED_PHRASES],
    customInstructions: normalizeCustomInstructions(overrides?.customInstructions),
    primaryTourTitle: primaryTour.title,
    primaryTourHeroImageUrl: primaryTour.imageUrls[0] || null,
    tourPages,
    blogPages: dedupeTrimmed(blogPages, MAX_BLOG_LINKS_IN_PROMPT),
    imageUrls,
    allowedPaths: tours.map((tour) => tour.canonicalPath),
  }
}

function parseJsonFromModelOutput(raw: string): RawGeneratedDraft {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error("Model returned an empty response")

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = (codeFenceMatch?.[1] || trimmed).trim()

  const firstBrace = candidate.indexOf("{")
  const lastBrace = candidate.lastIndexOf("}")
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model output is not valid JSON")
  }

  const jsonSlice = candidate.slice(firstBrace, lastBrace + 1)
  const parsed = JSON.parse(jsonSlice)
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model output JSON is invalid")
  }

  return parsed as RawGeneratedDraft
}

function extractLinks(contentMarkdown: string, contentHtml: string, siteUrl: string): string[] {
  const links: string[] = []
  const markdownPattern = /\[[^\]]+\]\(([^)\s]+)\)/g
  const htmlPattern = /href\s*=\s*["']([^"']+)["']/gi

  let markdownMatch: RegExpExecArray | null
  while ((markdownMatch = markdownPattern.exec(contentMarkdown)) !== null) {
    links.push(markdownMatch[1])
  }

  let htmlMatch: RegExpExecArray | null
  while ((htmlMatch = htmlPattern.exec(contentHtml)) !== null) {
    links.push(htmlMatch[1])
  }

  const normalized: string[] = []
  const site = new URL(siteUrl)

  for (const link of links) {
    const raw = normalizeText(link)
    if (!raw) continue

    try {
      const url = raw.startsWith("http://") || raw.startsWith("https://") ? new URL(raw) : new URL(raw, site)
      if (url.host !== site.host) continue
      normalized.push(`${url.pathname.replace(/\/$/, "") || "/"}`)
    } catch {
      continue
    }
  }

  return Array.from(new Set(normalized))
}

function matchRequiredTourUrlsInMarkdown(markdown: string): string[] {
  if (!markdown) return []
  return REQUIRED_TOUR_URLS.filter((url) => markdown.includes(url))
}

function stripLeadingMarkdownHeading(markdown: string): string {
  return markdown.replace(/^\s*#\s+.*(?:\r?\n)+/, "").trim()
}

function stripLeadingHtmlHeading(html: string): string {
  return html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "").trim()
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function markdownToPlainTextForGate(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function detectBannedPhraseMatches(options: { fullText: string; first100BodyText: string }): BannedPhraseMatch[] {
  const { fullText, first100BodyText } = options
  const matches: BannedPhraseMatch[] = []
  const loweredFull = fullText.toLowerCase()
  const loweredFirst100 = first100BodyText.toLowerCase().slice(0, 100)

  for (const rule of BANNED_PHRASE_RULES) {
    const haystack = rule.scope === "first_100_chars" ? loweredFirst100 : loweredFull
    if (!haystack) continue

    if (rule.mode === "phrase") {
      const needle = String(rule.value).toLowerCase()
      const index = haystack.indexOf(needle)
      if (index === -1) continue
      matches.push({
        phrase: rule.phrase,
        scope: rule.scope,
        index,
        matchedText: haystack.slice(index, index + needle.length),
      })
      continue
    }

    const regexValue = rule.value as RegExp
    const regex = new RegExp(regexValue.source, regexValue.flags.includes("i") ? regexValue.flags : `${regexValue.flags}i`)
    const regexMatch = regex.exec(rule.scope === "first_100_chars" ? first100BodyText.slice(0, 100) : fullText)
    if (!regexMatch || typeof regexMatch.index !== "number") continue

    matches.push({
      phrase: rule.phrase,
      scope: rule.scope,
      index: regexMatch.index,
      matchedText: normalizeText(regexMatch[0]),
    })
  }

  return matches
}

export function runBannedPhraseQualityGate(options: {
  contentMarkdown: string
  contentHtml: string
}): BannedPhraseGateResult {
  const hasMarkdown = normalizeMultiLineText(options.contentMarkdown).length > 0
  const scannedField: "content_markdown" | "content_html" = hasMarkdown ? "content_markdown" : "content_html"
  const fullText = hasMarkdown ? markdownToPlainTextForGate(options.contentMarkdown) : htmlToPlainText(options.contentHtml)
  const first100BodyText = hasMarkdown
    ? markdownToPlainTextForGate(stripLeadingMarkdownHeading(options.contentMarkdown))
    : htmlToPlainText(stripLeadingHtmlHeading(options.contentHtml))
  const matches = detectBannedPhraseMatches({ fullText, first100BodyText })

  return {
    failed: matches.length > 0,
    scannedField,
    scannedLength: fullText.length,
    matches,
  }
}

function createBannedPhraseGateError(details: BannedPhraseGateFailure): BannedPhraseGateError {
  const matched = details.matches
    .map((match) => `${match.phrase}:${match.scope}@${match.index}="${match.matchedText}"`)
    .join(", ")
  const error = new Error(
    `QUALITY_GATE_FAILED: ${BANNED_GENERIC_PHRASES_NOTE}; matched_phrases=[${matched}]`,
  ) as BannedPhraseGateError
  error.code = "QUALITY_GATE_BANNED_PHRASES"
  error.details = details
  return error
}

export function isBannedPhraseGateError(error: unknown): error is BannedPhraseGateError {
  if (!error || typeof error !== "object") return false
  const maybeError = error as { code?: unknown; details?: unknown }
  return maybeError.code === "QUALITY_GATE_BANNED_PHRASES" && Boolean(maybeError.details)
}

async function callOpenAi(context: PromptContext): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING")
  }

  const model = resolveBlogModel()
  const specificStopsLine =
    context.specificStops.length > 0 ? context.specificStops.join(", ") : "Moulin Rouge, Sacre-Coeur, Pont Neuf"
  const bannedListLine = context.bannedPromptPhrases.join(", ")
  const sharedContextLines = [
    `Topic: ${context.topic}`,
    `Primary keyword: ${context.primaryKeyword}`,
    `Secondary keywords: ${context.secondaryKeywords.join(", ")}`,
    `Long-tail questions: ${context.longTailQuestions.join(" | ")}`,
    `Primary tour context: ${context.primaryTourTitle}`,
    `Available tour pages to link: ${context.tourPages.join(", ")}`,
    `Available blog pages to link: ${context.blogPages.join(", ")}`,
    `Available images: ${context.imageUrls.join(", ")}`,
    "",
    `Write about ${context.topic}. Reference Pierre Gendrin and his Montmartre tour where relevant. Mention specific stops: ${specificStopsLine}. Do not use any of the following phrases: ${bannedListLine}.`,
    "Write a post about this topic that sounds like it was written by someone who has actually walked the streets of Paris with Pierre or Charles. Reference specific stops, real stories, and genuine local knowledge. Do not write anything a tourist brochure would say.",
    "You MUST include these exact links naturally in the content — not in a list, but woven into relevant sentences:",
    "- [https://www.tipwalk.com/tours/paris](https://www.tipwalk.com/tours/paris) — link this when referencing tours in Paris overall or browsing all Paris tours",
    "- [https://www.tipwalk.com/tours/paris/montmartre-walking-tour](https://www.tipwalk.com/tours/paris/montmartre-walking-tour) — link this when mentioning Pierre's Montmartre tour",
    "- [https://www.tipwalk.com/tours/paris/city-of-lights-walking-tour](https://www.tipwalk.com/tours/paris/city-of-lights-walking-tour) — link this when mentioning the City of Lights tour or Charles",
    "All three links must appear in the markdown output as standard markdown links: [anchor text](URL)",
    context.customInstructions ? `Additional instructions from admin:\n${context.customInstructions}` : "",
  ].filter(Boolean)

  const firstPassUserPrompt = [
    "Write one TipWalk blog draft in JSON format using this schema:",
    "{",
    '  "title": string,',
    '  "slug": string,',
    '  "meta_description": string,',
    '  "content_markdown": string,',
    '  "primary_keyword": string,',
    '  "secondary_keywords": string[5],',
    '  "long_tail_keywords": string[3],',
    '  "faq_schema": [{"question": string, "answer": string}]',
    "}",
    "",
    "Hard constraints for call 1:",
    "1) Write the introduction and first 3 body sections. Each body section must be at least 200 words. Do not summarise or truncate — write the full section completely.",
    "2) Do not include FAQ or final CTA yet.",
    "3) Return strict JSON only.",
    "",
    ...sharedContextLines,
    "",
    HARD_CONSTRAINT_BANNED_PHRASES_PROMPT_BLOCK,
  ].join("\n")

  const firstPassRaw = await callOpenAiChatCompletion({
    apiKey,
    model,
    systemPrompt: DAILY_AI_SYSTEM_PROMPT,
    userPrompt: firstPassUserPrompt,
    temperature: 0.7,
    maxTokens: 3000,
  })

  const firstPassParsed = parseJsonFromModelOutput(firstPassRaw)
  const firstPassMarkdown = normalizeMultiLineText(firstPassParsed.content_markdown)

  const secondPassUserPrompt = [
    HARD_CONSTRAINT_BANNED_PHRASES_PROMPT_BLOCK,
    "",
    "Call 2 task: continue the same article from where call 1 ended.",
    "Return markdown only (no JSON, no code fences).",
    "Do not repeat the title, opening paragraph, or the first 3 body sections from call 1.",
    "Continue the article with 3 more body sections plus FAQ and CTA. Each body section must be at least 150 words. The FAQ must have 5 questions with full answers of at least 3 sentences each. Do not end early.",
    "Ensure a link to https://www.tipwalk.com/tours/paris and at least 2 internal links to the provided individual tour pages across the full combined article.",
    "",
    ...sharedContextLines,
    "",
    "Existing call 1 markdown (do not repeat this content):",
    firstPassMarkdown || "(empty)",
  ].join("\n")

  const secondPassRaw = await callOpenAiChatCompletion({
    apiKey,
    model,
    systemPrompt: DAILY_AI_SYSTEM_PROMPT,
    userPrompt: secondPassUserPrompt,
    temperature: 0.7,
    maxTokens: 3800,
  })

  const continuationMarkdown = normalizeMultiLineText(stripMarkdownCodeFence(secondPassRaw))
  if (!continuationMarkdown) {
    throw new Error("OPENAI_SECOND_PASS_EMPTY_RESPONSE")
  }

  const mergedMarkdown = [firstPassMarkdown, continuationMarkdown].filter(Boolean).join("\n\n")
  const mergedHtml = mergedMarkdown
    ? markdownToHtml(mergedMarkdown)
    : normalizeMultiLineText(firstPassParsed.content_html)

  const mergedPayload: RawGeneratedDraft = {
    ...firstPassParsed,
    content_markdown: mergedMarkdown,
    content_html: mergedHtml,
  }

  return JSON.stringify(mergedPayload)
}

async function callOpenAiChatCompletion(options: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
}): Promise<string> {
  const { apiKey, model, systemPrompt, userPrompt, temperature, maxTokens } = options

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`OPENAI_REQUEST_FAILED: ${response.status} ${payload}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OPENAI_EMPTY_RESPONSE")
  }

  return content
}

async function rewriteMarkdownForBannedPhrases(options: {
  markdown: string
  title: string
  topic: string
  primaryKeyword: string
  secondaryKeywords: string[]
  longTailKeywords: string[]
  matchedPhrases: BannedPhraseMatch[]
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING")
  }

  const model = resolveBlogModel()
  const matchesBlock = options.matchedPhrases
    .map((match, index) => `${index + 1}. phrase="${match.phrase}" scope=${match.scope} snippet="${match.matchedText}"`)
    .join("\n")
  const matchedPhrasesInline = dedupeTrimmed(
    options.matchedPhrases.map((match) => match.phrase),
    60,
  ).join(", ")

  const userPrompt = [
    "You are fixing a markdown article that failed a banned-phrase quality gate.",
    `Rewrite only the sentences containing these specific phrases: ${matchedPhrasesInline || "[MATCHED_PHRASES]"}. Replace each banned phrase with a specific observation, detail, or fact about the actual place or experience being described. Do not use any synonym that appears on the banned list. The rewritten sentences must fit naturally into the surrounding paragraphs.`,
    "Do not remove headings, links, or factual content. Keep article structure intact.",
    "Do not delete sections. Keep the article detailed and natural.",
    "Return markdown only. No JSON. No code fences.",
    "",
    `Title: ${options.title}`,
    `Topic: ${options.topic}`,
    `Primary keyword: ${options.primaryKeyword}`,
    `Secondary keywords: ${options.secondaryKeywords.join(", ")}`,
    `Long-tail keywords: ${options.longTailKeywords.join(", ")}`,
    "",
    "Detected banned phrases to remove:",
    matchesBlock || "- none",
    "",
    HARD_CONSTRAINT_BANNED_PHRASES_PROMPT_BLOCK,
    "",
    "Current markdown:",
    options.markdown,
  ].join("\n")

  const rewritten = await callOpenAiChatCompletion({
    apiKey,
    model,
    systemPrompt: DAILY_AI_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.35,
    maxTokens: 4200,
  })

  return stripMarkdownCodeFence(rewritten)
}

function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  const match = trimmed.match(/```(?:markdown|md)?\s*([\s\S]*?)\s*```/i)
  return (match?.[1] || trimmed).trim()
}

async function expandMarkdownToMinWords(options: {
  markdown: string
  minWords: number
  requiredLinks: string[]
  title: string
  primaryKeyword: string
  secondaryKeywords: string[]
  longTailKeywords: string[]
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING")
  }

  const model = resolveBlogModel()
  const linksBlock = options.requiredLinks.map((link) => `- ${link}`).join("\n")
  const keywordsBlock = [
    `Primary keyword: ${options.primaryKeyword}`,
    `Secondary keywords: ${options.secondaryKeywords.join(", ")}`,
    `Long-tail keywords: ${options.longTailKeywords.join(", ")}`,
  ].join("\n")

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 4200,
      messages: [
        {
          role: "system",
          content:
            "You are a senior travel SEO editor. Return markdown only. Do not wrap output in JSON. Keep the copy factual and practical.",
        },
        {
          role: "user",
          content: [
            `Expand this blog draft to at least ${options.minWords} words (target 1400-1700).`,
            "Preserve and naturally include existing internal links; do not remove any existing links.",
            "Keep clear H2/H3 structure and readable paragraphs.",
            "Keep keyword usage natural (no stuffing).",
            HARD_CONSTRAINT_BANNED_PHRASES_PROMPT_BLOCK,
            "",
            `Title: ${options.title}`,
            keywordsBlock,
            "",
            "Required internal links to preserve/use:",
            linksBlock || "- none",
            "",
            "Current draft markdown:",
            options.markdown,
          ].join("\n"),
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`OPENAI_EXPAND_REQUEST_FAILED: ${response.status} ${payload}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OPENAI_EXPAND_EMPTY_RESPONSE")
  }

  return stripMarkdownCodeFence(content)
}

export async function resolveUniqueBlogSlug(
  supabase: ServiceSupabase,
  inputSlug: string,
  fallback: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = toSlug(inputSlug) || toSlug(fallback) || `paris-walking-tour-guide-${Date.now()}`
  const dateStr = new Date().toISOString().split("T")[0]
  const baseWithDate = `${baseSlug}-${dateStr}`

  const isSlugAvailable = async (candidate: string): Promise<boolean> => {
    const query = supabase.from("blog_posts").select("id").eq("slug", candidate).limit(1)
    const { data, error } = excludeId ? await query.neq("id", excludeId) : await query

    if (error) {
      throw new Error(`Unable to validate slug uniqueness: ${error.message}`)
    }

    const rows = Array.isArray(data) ? data : []
    return rows.length === 0
  }

  if (await isSlugAvailable(baseSlug)) {
    return baseSlug
  }

  if (await isSlugAvailable(baseWithDate)) {
    return baseWithDate
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomLetters = Math.random()
      .toString(36)
      .replace(/[^a-z]/g, "")
      .slice(0, 4) || "alt"
    const candidate = `${baseWithDate}-${randomLetters}`
    if (await isSlugAvailable(candidate)) {
      return candidate
    }
  }

  throw new Error("Unable to generate unique blog slug")
}

export function parseKeywordInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean)
  }

  const text = normalizeText(value)
  if (!text) return []

  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export async function generateApprovalReadyDraft(options: {
  supabase: ServiceSupabase
  siteUrl: string
  parisDateKey: string
  overrides?: BlogGenerationOverrides
}): Promise<GeneratedDraft> {
  const { supabase, siteUrl, parisDateKey, overrides } = options
  const [tours, blogSeed] = await Promise.all([
    fetchPublishedParisTours(supabase, siteUrl),
    fetchPublishedBlogSeed(supabase),
  ])

  if (!tours.length) {
    throw new Error("No published Paris tours available for link-safe generation")
  }

  const topicContext = buildTopicContext({
    tours,
    blogPages: blogSeed.blogPages,
    imageUrlsFromDb: blogSeed.imageUrls,
    parisDateKey,
    overrides,
  })

  const rawModelOutput = await callOpenAi(topicContext)
  const parsed = parseJsonFromModelOutput(rawModelOutput)

  const title = truncateText(normalizeText(parsed.title), 140)
  const metaDescription = truncateText(normalizeText(parsed.meta_description), 180)
  let contentMarkdown = normalizeMultiLineText(parsed.content_markdown)
  const contentHtmlFromModel = normalizeMultiLineText(parsed.content_html)
  let contentHtml = contentHtmlFromModel || markdownToHtml(contentMarkdown)
  const primaryKeyword = truncateText(normalizeText(parsed.primary_keyword), 120)
  const secondaryKeywords = normalizeKeywordArray(parsed.secondary_keywords, 5)
  const longTailKeywords = normalizeKeywordArray(parsed.long_tail_keywords, 3)
  const faqSchema = normalizeFaqSchema(parsed.faq_schema)

  const wordCountSource = contentMarkdown || contentHtml
  let wordCount = countWords(wordCountSource)
  let internalLinks = extractLinks(contentMarkdown, contentHtml, siteUrl)

  if (wordCount < MIN_WORDS && contentMarkdown) {
    try {
      const expandedMarkdown = await expandMarkdownToMinWords({
        markdown: contentMarkdown,
        minWords: EXPANSION_TARGET_WORDS,
        requiredLinks: [REQUIRED_PARIS_TOURS_URL, ...REQUIRED_TOUR_URLS],
        title,
        primaryKeyword,
        secondaryKeywords,
        longTailKeywords,
      })

      if (expandedMarkdown) {
        const expandedHtml = markdownToHtml(expandedMarkdown)
        const expandedLinks = extractLinks(expandedMarkdown, expandedHtml, siteUrl)
        const expandedWordCount = countWords(expandedMarkdown)

        if (expandedWordCount > wordCount) {
          contentMarkdown = expandedMarkdown
          contentHtml = expandedHtml
          wordCount = expandedWordCount
          internalLinks = expandedLinks
        }
      }
    } catch {
      // If expansion fails, final quality gate below will return a descriptive failure.
    }
  }

  let bannedGateResult = runBannedPhraseQualityGate({
    contentMarkdown,
    contentHtml,
  })

  for (let pass = 1; pass <= 2 && bannedGateResult.failed; pass += 1) {
    if (!contentMarkdown.trim()) break

    try {
      console.warn(
        `[daily-ai-blog] Banned phrase auto-fix pass ${pass} with phrases: ${bannedGateResult.matches
          .map((match) => match.phrase)
          .join(", ")}`,
      )

      const rewrittenMarkdown = await rewriteMarkdownForBannedPhrases({
        markdown: contentMarkdown,
        title,
        topic: topicContext.topic,
        primaryKeyword,
        secondaryKeywords,
        longTailKeywords,
        matchedPhrases: bannedGateResult.matches,
      })

      const normalizedRewritten = normalizeMultiLineText(rewrittenMarkdown)
      if (!normalizedRewritten) break

      contentMarkdown = normalizedRewritten
      contentHtml = markdownToHtml(contentMarkdown)
      wordCount = countWords(contentMarkdown)
      internalLinks = extractLinks(contentMarkdown, contentHtml, siteUrl)
      bannedGateResult = runBannedPhraseQualityGate({
        contentMarkdown,
        contentHtml,
      })
    } catch (rewriteError) {
      console.error(`[daily-ai-blog] Banned phrase auto-fix pass ${pass} failed:`, rewriteError)
      break
    }
  }

  const slugCandidate = toSlug(normalizeText(parsed.slug)) || toSlug(title) || `daily-ai-${parisDateKey}`
  const errors: string[] = []
  if (!title) errors.push("Missing title")
  if (!metaDescription) errors.push("Missing meta description")
  if (!contentMarkdown) errors.push("Missing content_markdown")
  if (!contentHtml) errors.push("Missing content_html")
  if (wordCount < MIN_WORDS) errors.push(`Word count below ${MIN_WORDS} (${wordCount})`)
  if (!primaryKeyword) errors.push("Missing primary keyword")
  if (secondaryKeywords.length < 5) errors.push("Secondary keyword pack must contain 5 items")
  if (longTailKeywords.length < 3) errors.push("Long-tail keyword pack must contain 3 items")

  const matchedInternalLinks = matchRequiredTourUrlsInMarkdown(contentMarkdown)
  if (matchedInternalLinks.length < 2) {
    errors.push("Content must include at least 2 internal links to existing canonical tour URLs")
  }
  const hasParisToursLink = contentMarkdown.includes(REQUIRED_PARIS_TOURS_URL)
  if (!hasParisToursLink) {
    errors.push("Content must include an internal link to https://www.tipwalk.com/tours/paris")
  }

  if (bannedGateResult.failed) {
    const matchedSummary = bannedGateResult.matches.map((entry) => entry.phrase).join(", ")
    console.error(
      `[daily-ai-blog] QUALITY_GATE_FAILED (${BANNED_GENERIC_PHRASES_NOTE}) field=${bannedGateResult.scannedField} len=${bannedGateResult.scannedLength} phrases=${matchedSummary}`,
    )
    throw createBannedPhraseGateError({
      note: BANNED_GENERIC_PHRASES_NOTE,
      title: title || "Daily AI draft blocked by quality gate",
      slugCandidate,
      metaDescription,
      contentMarkdown,
      contentHtml,
      primaryKeyword,
      secondaryKeywords,
      longTailKeywords,
      faqSchema,
      wordCount,
      matchedInternalLinks,
      gateResult: bannedGateResult,
      matches: bannedGateResult.matches,
    })
  }

  if (errors.length) {
    throw new Error(`QUALITY_GATE_FAILED: ${errors.join("; ")}`)
  }

  const generatedSlug = await resolveUniqueBlogSlug(supabase, normalizeText(parsed.slug), title)

  return {
    title,
    slug: generatedSlug,
    metaDescription,
    contentMarkdown,
    contentHtml,
    primaryKeyword,
    secondaryKeywords,
    longTailKeywords,
    faqSchema,
    wordCount,
    internalLinks: matchedInternalLinks,
    heroImageUrlCandidate: topicContext.primaryTourHeroImageUrl,
    heroImageAltCandidate: `${truncateText(title, 120)} - ${topicContext.primaryTourTitle}`,
    generationTopic: topicContext.topic,
  }
}

export async function generateDraftMediaAssets(options: {
  supabase: ServiceSupabase
  articleId: number
  slug: string
  title: string
  primaryKeyword: string
  secondaryKeywords: string[]
  longTailKeywords: string[]
  preferredHeroImageUrl?: string | null
  preferredHeroImageAlt?: string | null
}): Promise<GeneratedMediaAssets> {
  const {
    supabase,
    articleId,
    slug,
    title,
    primaryKeyword,
    secondaryKeywords,
    longTailKeywords,
    preferredHeroImageUrl,
    preferredHeroImageAlt,
  } = options

  const heroImageUrl = normalizeHttpUrl(preferredHeroImageUrl) || svgToDataUrl(buildSvgHeroFallback(title))
  const heroImageAlt = normalizeText(preferredHeroImageAlt) || `${truncateText(title, 120)} - Paris walking tour visual`

  let infographicImageUrl: string | null = null
  try {
    const generatedInfographicUrl = await generateInfographicImageUrlFromDalle({
      title,
      primaryKeyword,
      secondaryKeywords,
      longTailKeywords,
    })

    infographicImageUrl = await uploadInfographicImageFromRemoteUrl({
      supabase,
      slug,
      remoteImageUrl: generatedInfographicUrl,
    })
  } catch (error) {
    console.warn("[daily-ai-blog] Infographic generation/upload failed. Setting infographic_image_url to null:", error)
    infographicImageUrl = null
  }

  return {
    heroImageUrl,
    heroImageAlt,
    infographicImageUrl,
  }
}

export async function markAdminNotification(
  supabase: ServiceSupabase,
  payload: { type: string; title: string; message: string; data?: Record<string, unknown> },
): Promise<void> {
  const { type, title, message, data = {} } = payload

  const { error } = await supabase.from("admin_notifications").insert({
    type,
    title,
    message,
    data,
  })

  if (error) {
    console.error("[daily-ai-blog] Failed to create admin notification:", error)
  }
}

export function getDailyEventName(): string {
  return DAILY_EVENT
}

export function getDailyDeliveryId(parisDateKey: string): string {
  return `daily-ai-${parisDateKey}`
}

export function getCurrentParisDateKey(): string {
  return getParisDateKey()
}

export function buildMetaKeywords(primaryKeyword: string, secondaryKeywords: string[], longTailKeywords: string[]): string {
  return [primaryKeyword, ...secondaryKeywords, ...longTailKeywords].filter(Boolean).join(", ")
}

export function buildStoredKeywords(primaryKeyword: string, secondaryKeywords: string[], longTailKeywords: string[]): string[] {
  return [primaryKeyword, ...secondaryKeywords, ...longTailKeywords].filter(Boolean)
}
