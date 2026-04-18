import { type NextRequest, NextResponse } from "next/server"
import {
  BANNED_GENERIC_PHRASES_NOTE,
  buildMetaKeywords,
  buildStoredKeywords,
  generateApprovalReadyDraft,
  generateDraftMediaAssets,
  getCurrentParisDateKey,
  getDailyDeliveryId,
  isBannedPhraseGateError,
  markAdminNotification,
  resolveUniqueBlogSlug,
} from "@/lib/blog/daily-ai"
import {
  loadBlogGeneratorSettings,
  sanitizeBlogGeneratorSettingsInput,
  saveBlogGeneratorSettings,
  toBlogGenerationOverrides,
  type BlogGeneratorSettingsInput,
} from "@/lib/blog/generator-settings"
import { getSiteUrl } from "@/lib/site-url"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 120

type GenerateBody = BlogGeneratorSettingsInput & {
  persistSettings?: unknown
}

function createArticleId(): number {
  const suffix = Math.floor(Math.random() * 10)
  return Number(`${Date.now()}${suffix}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
  }
  return fallback
}

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Unauthorized", status: 401, user: null as null | { id: string } }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Admin access required", status: 403, user: null as null | { id: string } }

  return { error: null, status: 200, user: { id: user.id } }
}

export async function GET() {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const supabase = createServiceRoleClient()
    const settings = await loadBlogGeneratorSettings(supabase)
    return NextResponse.json({ settings })
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = (await request.json()) as BlogGeneratorSettingsInput
    const supabase = createServiceRoleClient()
    const current = await loadBlogGeneratorSettings(supabase)
    const next = sanitizeBlogGeneratorSettingsInput(body, current)
    const saved = await saveBlogGeneratorSettings(supabase, {
      ...next,
      updatedBy: auth.user?.id || null,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ settings: saved })
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = (await request.json()) as GenerateBody
    const persistSettings = parseBoolean(body.persistSettings, true)
    const supabase = createServiceRoleClient()

    const current = await loadBlogGeneratorSettings(supabase)
    const merged = sanitizeBlogGeneratorSettingsInput(body, current)
    const activeSettings = persistSettings
      ? await saveBlogGeneratorSettings(supabase, {
          ...merged,
          updatedBy: auth.user?.id || null,
          updatedAt: new Date().toISOString(),
        })
      : {
          ...merged,
          updatedBy: auth.user?.id || null,
          updatedAt: new Date().toISOString(),
        }

    const overrides = toBlogGenerationOverrides(activeSettings)
    const siteUrl = getSiteUrl()
    const parisDateKey = getCurrentParisDateKey()
    const manualEvent = "ai.manual.generated"
    const manualDeliveryId = `${getDailyDeliveryId(parisDateKey)}-manual-${Date.now()}`

    const maxAttempts = 3
    let generated: Awaited<ReturnType<typeof generateApprovalReadyDraft>> | null = null
    let lastError: unknown = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        generated = await generateApprovalReadyDraft({
          supabase,
          siteUrl,
          parisDateKey,
          overrides,
        })
        break
      } catch (error) {
        lastError = error
        if (isBannedPhraseGateError(error)) {
          throw error
        }

        const message = error instanceof Error ? error.message : String(error)
        const retryable =
          message.includes("QUALITY_GATE_FAILED") ||
          message.includes("OPENAI_") ||
          message.includes("Model output") ||
          message.includes("empty response")

        if (!retryable || attempt === maxAttempts) {
          throw error
        }

        await sleep(attempt * 750)
      }
    }

    if (!generated) {
      throw (lastError instanceof Error ? lastError : new Error("Unknown generation failure"))
    }

    const articleId = createArticleId()
    const createdAtIso = new Date().toISOString()
    const storedKeywords = buildStoredKeywords(
      generated.primaryKeyword,
      generated.secondaryKeywords,
      generated.longTailKeywords,
    )
    const media = await generateDraftMediaAssets({
      supabase,
      articleId,
      slug: generated.slug,
      title: generated.title,
      primaryKeyword: generated.primaryKeyword,
      secondaryKeywords: generated.secondaryKeywords,
      longTailKeywords: generated.longTailKeywords,
      preferredHeroImageUrl: generated.heroImageUrlCandidate,
      preferredHeroImageAlt: generated.heroImageAltCandidate,
    })

    const insertPayload = {
      autoseo_article_id: articleId,
      autoseo_delivery_id: manualDeliveryId,
      autoseo_event: manualEvent,
      title: generated.title,
      slug: generated.slug,
      meta_description: generated.metaDescription,
      content_html: generated.contentHtml,
      content_markdown: generated.contentMarkdown,
      hero_image_url: media.heroImageUrl,
      hero_image_alt: media.heroImageAlt,
      infographic_image_url: media.infographicImageUrl,
      keywords: storedKeywords,
      meta_keywords: buildMetaKeywords(generated.primaryKeyword, generated.secondaryKeywords, generated.longTailKeywords),
      faq_schema: generated.faqSchema,
      language_code: "en",
      status: "ready_for_approval",
      published_at: null,
      source_updated_at: createdAtIso,
      source_created_at: createdAtIso,
      source_payload: {
        pipeline: "daily_ai_blog",
        generation_mode: "manual_admin_generate",
        generated_by_admin: auth.user?.id || null,
        generator_settings: activeSettings,
        generation_topic: generated.generationTopic,
        media: {
          hero_image_url: media.heroImageUrl,
          hero_image_alt: media.heroImageAlt,
          infographic_image_url: media.infographicImageUrl,
        },
        quality: {
          minimum_words: 1200,
          word_count: generated.wordCount,
          internal_links_matched: generated.internalLinks,
          keyword_pack: {
            primary: generated.primaryKeyword,
            secondary_count: generated.secondaryKeywords.length,
            long_tail_count: generated.longTailKeywords.length,
          },
          banned_generic_phrases: {
            status: "passed",
            note: BANNED_GENERIC_PHRASES_NOTE,
            matches: [],
          },
        },
      },
      updated_at: createdAtIso,
    }

    const { data: inserted, error: insertError } = await supabase
      .from("blog_posts")
      .insert(insertPayload)
      .select("id, slug, status, created_at")
      .maybeSingle()

    if (insertError) {
      throw new Error(`Failed to save manual draft: ${insertError.message}`)
    }

    await markAdminNotification(supabase, {
      type: "blog_ready_for_approval",
      title: "Manual blog draft ready for approval",
      message: `${generated.title} is ready in /admin/blog for review and publish.`,
      data: {
        blog_post_id: inserted?.id || null,
        slug: generated.slug,
        status: "ready_for_approval",
        generation_mode: "manual_admin_generate",
      },
    })

    return NextResponse.json({
      success: true,
      settings: activeSettings,
      draft: {
        id: inserted?.id || null,
        slug: generated.slug,
        status: "ready_for_approval",
        wordCount: generated.wordCount,
        heroImageUrl: media.heroImageUrl,
        infographicImageUrl: media.infographicImageUrl,
      },
    })
  } catch (error) {
    console.error("[daily-ai-blog] Manual admin generation failed:", error)
    const isBannedPhraseFailure = isBannedPhraseGateError(error)
    const detectedPhrases = isBannedPhraseFailure ? error.details.matches.map((match) => match.phrase) : []
    let failedDraftSummary: {
      id: string | null
      slug: string
      status: string
      wordCount: number
      detectedPhrases: string[]
    } | null = null

    try {
      const supabase = createServiceRoleClient()
      let generationFailedPostId: string | null = null

      if (isBannedPhraseFailure) {
        const details = error.details
        const hasGeneratedContent = Boolean((details.contentHtml || "").trim() || (details.contentMarkdown || "").trim())

        if (hasGeneratedContent) {
          const nowIso = new Date().toISOString()
          const parisDateKey = getCurrentParisDateKey()
          const fallbackTitle = details.title || "Manual AI draft blocked by quality gate"
          const resolvedSlug = await resolveUniqueBlogSlug(supabase, details.slugCandidate, fallbackTitle)
          const storedKeywords = buildStoredKeywords(
            details.primaryKeyword,
            details.secondaryKeywords,
            details.longTailKeywords,
          )
          const articleId = createArticleId()

          const { data: failedRow, error: failedInsertError } = await supabase
            .from("blog_posts")
            .insert({
              autoseo_article_id: articleId,
              autoseo_delivery_id: `${getDailyDeliveryId(parisDateKey)}-manual-failed-${Date.now()}`,
              autoseo_event: "ai.manual.generated",
              title: fallbackTitle,
              slug: resolvedSlug,
              meta_description: details.metaDescription || null,
              content_html: details.contentHtml,
              content_markdown: details.contentMarkdown || null,
              keywords: storedKeywords,
              meta_keywords: buildMetaKeywords(
                details.primaryKeyword,
                details.secondaryKeywords,
                details.longTailKeywords,
              ),
              faq_schema: details.faqSchema,
              language_code: "en",
              status: "generation_failed",
              published_at: null,
              source_updated_at: nowIso,
              source_created_at: nowIso,
              source_payload: {
                pipeline: "daily_ai_blog",
                generation_mode: "manual_admin_generate",
                failure_note: BANNED_GENERIC_PHRASES_NOTE,
                quality: {
                  minimum_words: 1200,
                  word_count: details.wordCount,
                  internal_links_matched: details.matchedInternalLinks,
                  keyword_pack: {
                    primary: details.primaryKeyword,
                    secondary_count: details.secondaryKeywords.length,
                    long_tail_count: details.longTailKeywords.length,
                  },
                  banned_generic_phrases: {
                    status: "failed",
                    note: BANNED_GENERIC_PHRASES_NOTE,
                    scanned_field: details.gateResult.scannedField,
                    scanned_length: details.gateResult.scannedLength,
                    matches: details.matches,
                  },
                },
              },
              updated_at: nowIso,
            })
            .select("id, slug, status")
            .maybeSingle()

          if (!failedInsertError) {
            generationFailedPostId = failedRow?.id || null
            failedDraftSummary = {
              id: failedRow?.id || null,
              slug: failedRow?.slug || resolvedSlug,
              status: failedRow?.status || "generation_failed",
              wordCount: details.wordCount,
              detectedPhrases,
            }
          }
        }
      }

      await markAdminNotification(supabase, {
        type: "blog_generation_failed",
        title: "Manual blog generation failed",
        message: isBannedPhraseFailure
          ? `Manual AI draft blocked by quality gate. ${BANNED_GENERIC_PHRASES_NOTE}`
          : "Manual AI draft generation failed.",
        data: {
          error: error instanceof Error ? error.message : "Unknown error",
          note: isBannedPhraseFailure ? BANNED_GENERIC_PHRASES_NOTE : null,
          detected_phrases: isBannedPhraseFailure ? detectedPhrases : null,
          matched_phrase_details: isBannedPhraseFailure ? error.details.matches : null,
          blog_post_id: generationFailedPostId,
        },
      })
    } catch (notificationError) {
      console.error("[daily-ai-blog] Failed to emit manual generation failure notification:", notificationError)
    }

    return NextResponse.json(
      {
        error: "Manual blog generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
        qualityGate: isBannedPhraseFailure
          ? {
              note: BANNED_GENERIC_PHRASES_NOTE,
              detectedPhrases,
              matches: error.details.matches,
            }
          : null,
        failedDraft: failedDraftSummary,
      },
      { status: 500 },
    )
  }
}
