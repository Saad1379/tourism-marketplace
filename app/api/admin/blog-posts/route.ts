import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

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

function normalizeStatuses(raw: string | null): string[] {
  const fallback = "ready_for_approval"
  const value = (raw || fallback).trim()
  if (!value) return [fallback]

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export async function GET(request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { searchParams } = new URL(request.url)
    const statuses = normalizeStatuses(searchParams.get("status"))
    const search = (searchParams.get("search") || "").trim()
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)))
    const offset = (page - 1) * limit

    const supabase = createServiceRoleClient()
    let query = supabase
      .from("blog_posts")
      .select(
        "id, title, slug, status, meta_description, content_html, content_markdown, hero_image_url, hero_image_alt, infographic_image_url, keywords, meta_keywords, language_code, published_at, created_at, updated_at, source_payload",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })

    if (statuses.length === 1) {
      query = query.eq("status", statuses[0])
    } else {
      query = query.in("status", statuses)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`)
    }

    const { data, error: listError, count } = await query.range(offset, offset + limit - 1)

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 })
    }

    return NextResponse.json({
      posts: Array.isArray(data) ? data : [],
      total: count || 0,
      page,
      limit,
      statuses,
    })
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : "Unknown error" },
      { status: 500 },
    )
  }
}
