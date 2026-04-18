import { createHmac, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getSiteUrl } from "@/lib/site-url"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

const AUTOSEO_WEBHOOK_TOKEN =
  process.env.AUTOSEO_WEBHOOK_TOKEN || "aseo_wh_cd2ff136d3dce7315db0c7cb0b7e9143"
const AUTOSEO_STORAGE_BUCKET = process.env.AUTOSEO_STORAGE_BUCKET || "blog-media"
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]

type AutoSeoFaqItem = {
  question?: unknown
  answer?: unknown
}

type AutoSeoPayload = {
  event?: unknown
  id?: unknown
  title?: unknown
  slug?: unknown
  metaDescription?: unknown
  content_html?: unknown
  content_markdown?: unknown
  heroImageUrl?: unknown
  heroImageAlt?: unknown
  infographicImageUrl?: unknown
  keywords?: unknown
  metaKeywords?: unknown
  faqSchema?: unknown
  languageCode?: unknown
  status?: unknown
  publishedAt?: unknown
  updatedAt?: unknown
  createdAt?: unknown
}

type ServiceSupabase = ReturnType<typeof createServiceRoleClient>

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value)
  return normalized.length > 0 ? normalized : null
}

function normalizeSlug(value: unknown, articleId: number): string {
  const fromPayload = normalizeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (fromPayload) return fromPayload.slice(0, 200)
  return `article-${articleId}`
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const entry of value) {
    const keyword = normalizeString(entry)
    if (!keyword) continue
    const dedupeKey = keyword.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    keywords.push(keyword.slice(0, 120))
  }
  return keywords
}

function normalizeFaqSchema(value: unknown): Array<{ question: string; answer: string }> | null {
  if (!Array.isArray(value)) return null
  const items: Array<{ question: string; answer: string }> = []

  for (const rawItem of value as AutoSeoFaqItem[]) {
    const question = normalizeString(rawItem?.question)
    const answer = normalizeString(rawItem?.answer)
    if (!question || !answer) continue
    items.push({ question, answer })
  }

  return items.length > 0 ? items : null
}

function normalizeIsoTimestamp(value: unknown): string | null {
  const input = normalizeString(value)
  if (!input) return null

  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizeHexSignature(headerValue: string): string {
  const trimmed = headerValue.trim().toLowerCase()
  return trimmed.startsWith("sha256=") ? trimmed.slice("sha256=".length) : trimmed
}

function isHexString(value: string): boolean {
  return /^[a-f0-9]+$/i.test(value)
}

function verifyHmacSignature(rawBody: string, providedHeader: string, secret: string): boolean {
  const providedHex = normalizeHexSignature(providedHeader)
  if (!providedHex || !isHexString(providedHex)) return false

  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex")

  // timingSafeEqual throws on unequal lengths, so we check first.
  if (providedHex.length !== expectedHex.length) return false

  return timingSafeEqual(Buffer.from(providedHex, "hex"), Buffer.from(expectedHex, "hex"))
}

async function ensureBucketExists(supabase: ServiceSupabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(`Unable to list storage buckets: ${error.message}`)

  if (buckets?.some((bucket) => bucket.id === AUTOSEO_STORAGE_BUCKET)) return

  const { error: createError } = await supabase.storage.createBucket(AUTOSEO_STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: ACCEPTED_IMAGE_MIME_TYPES,
  })

  // Bucket may have been created by another parallel request.
  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(`Unable to create storage bucket "${AUTOSEO_STORAGE_BUCKET}": ${createError.message}`)
  }
}

function extensionFromContentType(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    case "image/avif":
      return "avif"
    default:
      return "jpg"
  }
}

function extensionFromUrlPath(pathname: string): string | null {
  const cleanPath = pathname.split("?")[0].toLowerCase()
  if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) return "jpg"
  if (cleanPath.endsWith(".png")) return "png"
  if (cleanPath.endsWith(".webp")) return "webp"
  if (cleanPath.endsWith(".gif")) return "gif"
  if (cleanPath.endsWith(".avif")) return "avif"
  return null
}

async function downloadAndStoreImage(
  supabase: ServiceSupabase,
  imageUrl: string | null,
  articleId: number,
  imageType: "hero" | "infographic",
): Promise<string | null> {
  if (!imageUrl) return null

  let parsedUrl: URL
  try {
    parsedUrl = new URL(imageUrl)
  } catch {
    throw new Error(`Invalid ${imageType} image URL`)
  }

  const response = await fetch(parsedUrl.toString(), {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to download ${imageType} image (${response.status})`)
  }

  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  if (!contentType.startsWith("image/")) {
    throw new Error(`Downloaded ${imageType} file is not an image`)
  }

  const data = await response.arrayBuffer()
  if (data.byteLength === 0) {
    throw new Error(`${imageType} image is empty`)
  }
  if (data.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`${imageType} image exceeds ${MAX_IMAGE_BYTES} bytes`)
  }

  const extension = extensionFromUrlPath(parsedUrl.pathname) || extensionFromContentType(contentType)
  const objectPath = `autoseo/${articleId}/${imageType}-${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(AUTOSEO_STORAGE_BUCKET)
    .upload(objectPath, Buffer.from(data), { upsert: true, contentType: contentType || `image/${extension}` })

  if (uploadError) {
    throw new Error(`Failed to upload ${imageType} image: ${uploadError.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AUTOSEO_STORAGE_BUCKET).getPublicUrl(objectPath)

  return publicUrl
}

async function resolveUniqueSlug(supabase: ServiceSupabase, baseSlug: string, articleId: number): Promise<string> {
  const candidateSlugs = [baseSlug, `${baseSlug}-${articleId}`, `${baseSlug}-${articleId}-2`]

  for (const slug of candidateSlugs) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("autoseo_article_id")
      .eq("slug", slug)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      throw new Error(`Unable to validate slug uniqueness: ${error.message}`)
    }

    if (!data || Number(data.autoseo_article_id) === articleId) {
      return slug
    }
  }

  throw new Error("Unable to generate a unique slug")
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${AUTOSEO_WEBHOOK_TOKEN}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rawBody = await request.text()
    const providedSignature = request.headers.get("x-autoseo-signature")

    if (providedSignature && !verifyHmacSignature(rawBody, providedSignature, AUTOSEO_WEBHOOK_TOKEN)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    let payload: AutoSeoPayload
    try {
      payload = JSON.parse(rawBody) as AutoSeoPayload
    } catch {
      throw new Error("Invalid JSON body")
    }

    const event = normalizeString(payload.event)
    const siteUrl = getSiteUrl()

    if (event === "test") {
      return NextResponse.json({ url: `${siteUrl}/test` }, { status: 200 })
    }

    if (event !== "article.published") {
      throw new Error(`Unsupported event: ${event || "(empty)"}`)
    }

    const articleId = Number(payload.id)
    if (!Number.isInteger(articleId) || articleId <= 0) {
      throw new Error("Invalid or missing article id")
    }

    const title = normalizeString(payload.title)
    const contentHtml = normalizeString(payload.content_html)
    if (!title) throw new Error("Missing title")
    if (!contentHtml) throw new Error("Missing content_html")

    const baseSlug = normalizeSlug(payload.slug, articleId)
    const serviceSupabase = createServiceRoleClient()

    await ensureBucketExists(serviceSupabase)
    const slug = await resolveUniqueSlug(serviceSupabase, baseSlug, articleId)

    const heroImageInputUrl = normalizeNullableString(payload.heroImageUrl)
    const infographicInputUrl = normalizeNullableString(payload.infographicImageUrl)

    const [heroImageUrl, infographicImageUrl] = await Promise.all([
      downloadAndStoreImage(serviceSupabase, heroImageInputUrl, articleId, "hero"),
      downloadAndStoreImage(serviceSupabase, infographicInputUrl, articleId, "infographic"),
    ])

    const url = `${siteUrl}/blog/${slug}`

    const upsertPayload = {
      autoseo_article_id: articleId,
      autoseo_delivery_id: normalizeNullableString(request.headers.get("x-autoseo-delivery")),
      autoseo_event: event,
      title,
      slug,
      meta_description: normalizeNullableString(payload.metaDescription),
      content_html: contentHtml,
      content_markdown: normalizeNullableString(payload.content_markdown),
      hero_image_url: heroImageUrl,
      hero_image_alt: normalizeNullableString(payload.heroImageAlt),
      infographic_image_url: infographicImageUrl,
      keywords: normalizeKeywords(payload.keywords),
      meta_keywords: normalizeNullableString(payload.metaKeywords),
      faq_schema: normalizeFaqSchema(payload.faqSchema),
      language_code: normalizeString(payload.languageCode) || "en",
      status: normalizeString(payload.status) || "published",
      published_at: normalizeIsoTimestamp(payload.publishedAt),
      source_updated_at: normalizeIsoTimestamp(payload.updatedAt),
      source_created_at: normalizeIsoTimestamp(payload.createdAt),
      source_payload: payload,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await serviceSupabase
      .from("blog_posts")
      .upsert(upsertPayload, { onConflict: "autoseo_article_id" })

    if (upsertError) {
      throw new Error(`Database upsert failed: ${upsertError.message}`)
    }

    return NextResponse.json({ url }, { status: 200 })
  } catch (error) {
    console.error("[autoseo-webhook] Failed to process request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
