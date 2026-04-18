import { NextRequest, NextResponse } from "next/server"
import {
  BANNED_GENERIC_PHRASES_NOTE,
  buildMetaKeywords,
  buildStoredKeywords,
  generateApprovalReadyDraft,
  generateDraftMediaAssets,
  getCurrentParisDateKey,
  getDailyDeliveryId,
  getDailyEventName,
  isBannedPhraseGateError,
  markAdminNotification,
  resolveUniqueBlogSlug,
} from "@/lib/blog/daily-ai"
import { loadBlogGeneratorSettings, toBlogGenerationOverrides } from "@/lib/blog/generator-settings"
import { getSiteUrl } from "@/lib/site-url"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 120

function createArticleId(): number {
  const suffix = Math.floor(Math.random() * 10)
  return Number(`${Date.now()}${suffix}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const force = searchParams.get("force") === "1"

    const supabase = createServiceRoleClient()
    const siteUrl = getSiteUrl()
    const parisDateKey = getCurrentParisDateKey()
    const dailyEvent = getDailyEventName()
    const dailyDeliveryId = getDailyDeliveryId(parisDateKey)
    const generatorSettings = await loadBlogGeneratorSettings(supabase)
    const generationOverrides = generatorSettings.applyToDaily ? toBlogGenerationOverrides(generatorSettings) : undefined

    if (!force) {
      const { data: existingRow, error: existingError } = await supabase
        .from("blog_posts")
        .select("id, slug, status, created_at")
        .eq("autoseo_event", dailyEvent)
        .eq("autoseo_delivery_id", dailyDeliveryId)
        .limit(1)
        .maybeSingle()

      if (existingError && existingError.code !== "PGRST116") {
        throw new Error(`Failed to check existing daily draft: ${existingError.message}`)
      }

      if (existingRow?.id) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "Daily draft already exists",
          row: existingRow,
        })
      }
    }

    const maxAttempts = 3
    let generated: Awaited<ReturnType<typeof generateApprovalReadyDraft>> | null = null
    let lastError: unknown = null
    let generationAttempts = 0

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      generationAttempts = attempt
      try {
        generated = await generateApprovalReadyDraft({
          supabase,
          siteUrl,
          parisDateKey,
          overrides: generationOverrides,
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
      autoseo_delivery_id: dailyDeliveryId,
      autoseo_event: dailyEvent,
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
        paris_date: parisDateKey,
        generation_mode: "ai_draft_human_approval",
        generation_attempts: generationAttempts,
        generation_topic: generated.generationTopic,
        generator_settings_applied: generatorSettings.applyToDaily,
        generator_settings: generatorSettings.applyToDaily ? generatorSettings : null,
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
      throw new Error(`Failed to save daily draft: ${insertError.message}`)
    }

    await markAdminNotification(supabase, {
      type: "blog_ready_for_approval",
      title: "Daily blog draft ready for approval",
      message: `${generated.title} is ready in /admin/blog for review and publish.`,
      data: {
        blog_post_id: inserted?.id || null,
        slug: generated.slug,
        status: "ready_for_approval",
      },
    })

    return NextResponse.json({
      success: true,
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
    console.error("[daily-ai-blog] Cron draft generation failed:", error)

    try {
      const supabase = createServiceRoleClient()
      const isBannedPhraseFailure = isBannedPhraseGateError(error)
      let generationFailedPostId: string | null = null

      if (isBannedPhraseFailure) {
        const details = error.details
        const detectedPhrases = details.matches.map((match) => match.phrase)
        console.error(
          `[daily-ai-blog] Banned phrase gate triggered: ${detectedPhrases.join(", ")} | field=${details.gateResult.scannedField} | len=${details.gateResult.scannedLength}`,
        )
        const hasGeneratedContent = Boolean((details.contentHtml || "").trim() || (details.contentMarkdown || "").trim())

        if (hasGeneratedContent) {
          const nowIso = new Date().toISOString()
          const parisDateKey = getCurrentParisDateKey()
          const dailyEvent = getDailyEventName()
          const dailyDeliveryId = getDailyDeliveryId(parisDateKey)
          const fallbackTitle = details.title || "Daily AI draft blocked by quality gate"
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
              autoseo_delivery_id: dailyDeliveryId,
              autoseo_event: dailyEvent,
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
                paris_date: parisDateKey,
                generation_mode: "ai_draft_human_approval",
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
            .select("id")
            .maybeSingle()

          if (failedInsertError) {
            console.error("[daily-ai-blog] Failed to persist generation_failed row:", failedInsertError)
          } else {
            generationFailedPostId = failedRow?.id || null
          }
        }
      }

      await markAdminNotification(supabase, {
        type: "blog_generation_failed",
        title: "Daily blog generation failed",
        message: isBannedPhraseFailure
          ? `Daily AI draft blocked by quality gate. ${BANNED_GENERIC_PHRASES_NOTE}`
          : "Daily AI draft failed quality checks or generation. No post was published.",
        data: {
          error: error instanceof Error ? error.message : "Unknown error",
          note: isBannedPhraseFailure ? BANNED_GENERIC_PHRASES_NOTE : null,
          detected_phrases: isBannedPhraseFailure ? error.details.matches.map((match) => match.phrase) : null,
          matched_phrase_details: isBannedPhraseFailure ? error.details.matches : null,
          blog_post_id: generationFailedPostId,
        },
      })
    } catch (notificationError) {
      console.error("[daily-ai-blog] Failed to emit failure notification:", notificationError)
    }

    return NextResponse.json(
      {
        error: "Daily blog generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
