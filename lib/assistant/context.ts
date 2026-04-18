import type { AssistantChatMessage, AssistantPageContext } from "@/lib/assistant/types"

export const ASSISTANT_MAX_MESSAGE_CHARS = 1200
export const ASSISTANT_MAX_HISTORY_ITEMS = 8
export const ASSISTANT_MAX_HISTORY_CHARS = 600

export function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizePageContext(input: AssistantPageContext | null | undefined): AssistantPageContext {
  return {
    pathname: normalizeText(input?.pathname) || null,
    citySlug: normalizeSlug(input?.citySlug),
    tourSlug: normalizeSlug(input?.tourSlug),
    tourId: normalizeText(input?.tourId) || null,
    guideId: normalizeText(input?.guideId) || null,
  }
}

export function parseTourContextFromPathname(pathname: string | null | undefined): {
  citySlug: string
  tourSlug: string
} | null {
  const normalizedPath = normalizeText(pathname)
  if (!normalizedPath) return null

  const segments = normalizedPath.split("?")[0].split("/").filter(Boolean)
  if (segments.length < 3) return null
  if (segments[0] !== "tours") return null

  const citySlug = normalizeSlug(segments[1])
  const tourSlug = normalizeSlug(segments[2])
  if (!citySlug || !tourSlug) return null

  return { citySlug, tourSlug }
}

export function sanitizeAssistantHistory(history: unknown): AssistantChatMessage[] {
  if (!Array.isArray(history)) return []

  const sanitized = history
    .map((entry): AssistantChatMessage | null => {
      if (!entry || typeof entry !== "object") return null
      const role = (entry as { role?: unknown }).role
      const content = normalizeText((entry as { content?: unknown }).content).slice(0, ASSISTANT_MAX_HISTORY_CHARS)
      if ((role !== "user" && role !== "assistant") || !content) return null
      return { role, content }
    })
    .filter((entry): entry is AssistantChatMessage => Boolean(entry))

  if (sanitized.length <= ASSISTANT_MAX_HISTORY_ITEMS) return sanitized
  return sanitized.slice(-ASSISTANT_MAX_HISTORY_ITEMS)
}

function normalizeSlug(value: unknown): string | null {
  const text = normalizeText(value)
  if (!text) return null
  return text.toLowerCase().replace(/[^a-z0-9-]/g, "")
}
