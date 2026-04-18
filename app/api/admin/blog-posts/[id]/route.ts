import { type NextRequest, NextResponse } from "next/server"
import { parseKeywordInput } from "@/lib/blog/daily-ai"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

type UpdatePayload = {
  title?: unknown
  slug?: unknown
  meta_description?: unknown
  content_html?: unknown
  content_markdown?: unknown
  hero_image_url?: unknown
  hero_image_alt?: unknown
  infographic_image_url?: unknown
  keywords?: unknown
  meta_keywords?: unknown
}

const BASE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE_SUFFIX_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}-\d{2}-\d{2}$/

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Unauthorized", status: 401 }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Admin access required", status: 403 }

  return { error: null, status: 200 }
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeSlug(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function normalizeMultiLineText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stripMarkdownCodeFence(value: string): string {
  if (!value) return value
  return value
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

function normalizeNullableUrl(value: unknown): string | null {
  const raw = normalizeText(value)
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (!["http:", "https:"].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

function isValidSlug(value: string): boolean {
  return BASE_SLUG_PATTERN.test(value) || DATE_SUFFIX_SLUG_PATTERN.test(value)
}

function buildDateSuffixSuggestion(slug: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const base = slug.replace(/-\d{4}-\d{2}-\d{2}$/, "")
  return `${base}-${today}`
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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await context.params
    const body = (await request.json()) as UpdatePayload
    const supabase = createServiceRoleClient()

    const { data: existing, error: fetchError } = await supabase
      .from("blog_posts")
      .select("id, title, slug, keywords, hero_image_url, hero_image_alt, infographic_image_url, content_markdown, content_html")
      .eq("id", id)
      .maybeSingle()

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json({ error: fetchError.message }, { status: 400 })
    }

    if (!existing?.id) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 })
    }

    const nextTitle = normalizeText(body.title)
    const requestedSlug = normalizeSlug(body.slug)
    const metaDescription = normalizeText(body.meta_description)
    const contentHtml = stripMarkdownCodeFence(normalizeMultiLineText(body.content_html))
    const contentMarkdown = normalizeMultiLineText(body.content_markdown)
    const heroImageUrl = body.hero_image_url === undefined ? undefined : normalizeNullableUrl(body.hero_image_url)
    const heroImageAlt = body.hero_image_alt === undefined ? undefined : normalizeText(body.hero_image_alt) || null
    const infographicImageUrl =
      body.infographic_image_url === undefined ? undefined : normalizeNullableUrl(body.infographic_image_url)
    const nextKeywords = body.keywords === undefined ? null : parseKeywordInput(body.keywords)
    const metaKeywordsInput = body.meta_keywords === undefined ? null : normalizeText(body.meta_keywords)

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.title !== undefined) {
      if (!nextTitle) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
      updatePayload.title = nextTitle
    }

    if (body.slug !== undefined) {
      if (!requestedSlug) {
        return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 })
      }

      if (!isValidSlug(requestedSlug)) {
        return NextResponse.json(
          {
            error:
              "Invalid slug format. Use lowercase letters/numbers separated by hyphens (example: how-much-to-tip-tour-guide-paris).",
          },
          { status: 400 },
        )
      }

      const { data: existingSlugRows, error: slugCheckError } = await supabase
        .from("blog_posts")
        .select("id")
        .eq("slug", requestedSlug)
        .neq("id", id)
        .limit(1)

      if (slugCheckError) {
        return NextResponse.json({ error: slugCheckError.message }, { status: 400 })
      }

      const slugAlreadyExists = Array.isArray(existingSlugRows) && existingSlugRows.length > 0
      if (slugAlreadyExists) {
        const slugSuggestion = buildDateSuffixSuggestion(requestedSlug)
        return NextResponse.json(
          {
            error: `Slug already exists. Suggested format: ${slugSuggestion}`,
            code: "SLUG_ALREADY_EXISTS",
            slugSuggestion,
          },
          { status: 409 },
        )
      }

      updatePayload.slug = requestedSlug
    }

    if (body.meta_description !== undefined) {
      updatePayload.meta_description = metaDescription || null
    }

    if (body.content_html !== undefined) {
      if (!contentHtml) return NextResponse.json({ error: "content_html cannot be empty" }, { status: 400 })
      updatePayload.content_html = contentHtml
    }

    if (body.content_markdown !== undefined) {
      if (!contentMarkdown) return NextResponse.json({ error: "content_markdown cannot be empty" }, { status: 400 })
      updatePayload.content_markdown = contentMarkdown
      if (body.content_html === undefined) {
        updatePayload.content_html = markdownToHtml(contentMarkdown)
      }
    }

    if (body.hero_image_url !== undefined) {
      updatePayload.hero_image_url = heroImageUrl
    }

    if (body.hero_image_alt !== undefined) {
      updatePayload.hero_image_alt = heroImageAlt
    }

    if (body.infographic_image_url !== undefined) {
      updatePayload.infographic_image_url = infographicImageUrl
    }

    if (nextKeywords !== null) {
      updatePayload.keywords = nextKeywords
      if (metaKeywordsInput === null) {
        updatePayload.meta_keywords = nextKeywords.join(", ") || null
      }
    }

    if (metaKeywordsInput !== null) {
      updatePayload.meta_keywords = metaKeywordsInput || null
    }

    const { data: updated, error: updateError } = await supabase
      .from("blog_posts")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id, title, slug, status, meta_description, content_html, content_markdown, hero_image_url, hero_image_alt, infographic_image_url, keywords, meta_keywords, language_code, published_at, created_at, updated_at, source_payload",
      )
      .maybeSingle()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ post: updated })
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : "Unknown error" },
      { status: 500 },
    )
  }
}
