import { revalidatePath } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"
import { markAdminNotification } from "@/lib/blog/daily-ai"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

type ActionBody = {
  action?: unknown
  reason?: unknown
}

type ReviewAction = "approve_publish" | "request_regeneration" | "reject"

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

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeAction(value: unknown): ReviewAction | null {
  const action = normalizeText(value)
  if (action === "approve_publish") return "approve_publish"
  if (action === "request_regeneration") return "request_regeneration"
  if (action === "reject") return "reject"
  return null
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await context.params
    const body = (await request.json()) as ActionBody
    const action = normalizeAction(body.action)

    if (!action) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const reason = normalizeText(body.reason)
    const supabase = createServiceRoleClient()

    const { data: existing, error: fetchError } = await supabase
      .from("blog_posts")
      .select("id, title, slug, status, source_payload")
      .eq("id", id)
      .maybeSingle()

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json({ error: fetchError.message }, { status: 400 })
    }

    if (!existing?.id) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 })
    }

    const nowIso = new Date().toISOString()
    const sourcePayload = toJsonObject(existing.source_payload)
    const review = {
      action,
      reason: reason || null,
      at: nowIso,
    }

    let nextStatus: string
    let publishedAt: string | null

    if (action === "approve_publish") {
      if (existing.status !== "ready_for_approval") {
        return NextResponse.json(
          { error: "Only ready_for_approval drafts can be approved and published" },
          { status: 400 },
        )
      }
      nextStatus = "published"
      publishedAt = new Date().toISOString()
    } else if (action === "request_regeneration") {
      nextStatus = "regeneration_requested"
      publishedAt = null
    } else {
      nextStatus = "rejected"
      publishedAt = null
    }

    const { data: updated, error: updateError } = await supabase
      .from("blog_posts")
      .update({
        status: nextStatus,
        published_at: publishedAt,
        updated_at: nowIso,
        source_payload: {
          ...sourcePayload,
          review,
        },
      })
      .eq("id", id)
      .select(
        "id, title, slug, status, meta_description, content_html, content_markdown, hero_image_url, hero_image_alt, infographic_image_url, keywords, meta_keywords, language_code, published_at, created_at, updated_at, source_payload",
      )
      .maybeSingle()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    if (action === "approve_publish") {
      const publishedSlug = normalizeText(updated?.slug) || normalizeText(existing.slug)
      revalidatePath("/blog")
      revalidatePath(`/blog/${publishedSlug}`)
      revalidatePath("/sitemap.xml")

      await markAdminNotification(supabase, {
        type: "blog_published",
        title: "Blog post published",
        message: `${existing.title} is now live.`,
        data: { blog_post_id: existing.id, slug: publishedSlug },
      })
    }

    if (action === "request_regeneration") {
      await markAdminNotification(supabase, {
        type: "blog_regeneration_requested",
        title: "Blog draft regeneration requested",
        message: `${existing.title} was marked for regeneration.`,
        data: { blog_post_id: existing.id, slug: existing.slug, reason: reason || null },
      })
    }

    if (action === "reject") {
      await markAdminNotification(supabase, {
        type: "blog_rejected",
        title: "Blog draft rejected",
        message: `${existing.title} was rejected during review.`,
        data: { blog_post_id: existing.id, slug: existing.slug, reason: reason || null },
      })
    }

    return NextResponse.json({ post: updated })
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : "Unknown error" },
      { status: 500 },
    )
  }
}
