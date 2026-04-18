import type { BlogGenerationOverrides } from "@/lib/blog/daily-ai"

type ServiceSupabase = {
  from: (table: string) => any
}

export const BLOG_GENERATION_SETTINGS_KEY = "blog_generation_settings"
export const BLOG_GENERATION_MEDIA_POLICY = "tour_hero_ai_infographic" as const

export type BlogGenerationMediaPolicy = typeof BLOG_GENERATION_MEDIA_POLICY

export type BlogGeneratorSettings = {
  topic: string
  primaryKeyword: string
  secondaryKeywords: string[]
  longTailQuestions: string[]
  customInstructions: string
  applyToDaily: boolean
  mediaPolicy: BlogGenerationMediaPolicy
  updatedBy: string | null
  updatedAt: string | null
}

export type BlogGeneratorSettingsInput = {
  topic?: unknown
  primaryKeyword?: unknown
  secondaryKeywords?: unknown
  longTailQuestions?: unknown
  customInstructions?: unknown
  applyToDaily?: unknown
  mediaPolicy?: unknown
}

const DEFAULT_SETTINGS: BlogGeneratorSettings = {
  topic: "",
  primaryKeyword: "",
  secondaryKeywords: [],
  longTailQuestions: [],
  customInstructions: "",
  applyToDaily: false,
  mediaPolicy: BLOG_GENERATION_MEDIA_POLICY,
  updatedBy: null,
  updatedAt: null,
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function normalizeLongText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return ""
  return value.replace(/\r\n/g, "\n").trim().slice(0, maxLength)
}

function parseListInput(value: unknown, options: { maxItems: number; maxLength: number }): string[] {
  let rawItems: string[] = []

  if (Array.isArray(value)) {
    rawItems = value.map((entry) => String(entry ?? ""))
  } else if (typeof value === "string") {
    const source = value.trim()
    if (!source) return []
    rawItems = source.includes("\n") ? source.split(/\r?\n/) : source.split(",")
  } else {
    return []
  }

  const seen = new Set<string>()
  const output: string[] = []

  for (const raw of rawItems) {
    const normalized = normalizeText(raw)
    if (!normalized) continue
    const clipped = normalized.slice(0, options.maxLength)
    const key = clipped.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(clipped)
    if (output.length >= options.maxItems) break
  }

  return output
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

function normalizeMediaPolicy(value: unknown): BlogGenerationMediaPolicy {
  return value === BLOG_GENERATION_MEDIA_POLICY ? BLOG_GENERATION_MEDIA_POLICY : BLOG_GENERATION_MEDIA_POLICY
}

function parseStoredSettings(value: unknown): Partial<BlogGeneratorSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const row = value as Record<string, unknown>
  return {
    topic: normalizeText(row.topic).slice(0, 120),
    primaryKeyword: normalizeText(row.primaryKeyword).slice(0, 120),
    secondaryKeywords: parseListInput(row.secondaryKeywords, { maxItems: 5, maxLength: 120 }),
    longTailQuestions: parseListInput(row.longTailQuestions, { maxItems: 3, maxLength: 180 }),
    customInstructions: normalizeLongText(row.customInstructions, 2000),
    applyToDaily: parseBoolean(row.applyToDaily, false),
    mediaPolicy: normalizeMediaPolicy(row.mediaPolicy),
    updatedBy: normalizeText(row.updatedBy) || null,
    updatedAt: normalizeText(row.updatedAt) || null,
  }
}

export function sanitizeBlogGeneratorSettingsInput(
  input: BlogGeneratorSettingsInput,
  current: BlogGeneratorSettings,
): BlogGeneratorSettings {
  return {
    topic: input.topic === undefined ? current.topic : normalizeText(input.topic).slice(0, 120),
    primaryKeyword:
      input.primaryKeyword === undefined ? current.primaryKeyword : normalizeText(input.primaryKeyword).slice(0, 120),
    secondaryKeywords:
      input.secondaryKeywords === undefined
        ? current.secondaryKeywords
        : parseListInput(input.secondaryKeywords, { maxItems: 5, maxLength: 120 }),
    longTailQuestions:
      input.longTailQuestions === undefined
        ? current.longTailQuestions
        : parseListInput(input.longTailQuestions, { maxItems: 3, maxLength: 180 }),
    customInstructions:
      input.customInstructions === undefined
        ? current.customInstructions
        : normalizeLongText(input.customInstructions, 2000),
    applyToDaily: input.applyToDaily === undefined ? current.applyToDaily : parseBoolean(input.applyToDaily, current.applyToDaily),
    mediaPolicy: input.mediaPolicy === undefined ? current.mediaPolicy : normalizeMediaPolicy(input.mediaPolicy),
    updatedBy: current.updatedBy,
    updatedAt: current.updatedAt,
  }
}

export async function loadBlogGeneratorSettings(supabase: ServiceSupabase): Promise<BlogGeneratorSettings> {
  const { data, error } = await supabase
    .from("platform_config")
    .select("value, updated_at")
    .eq("key", BLOG_GENERATION_SETTINGS_KEY)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to load blog generator settings: ${error.message}`)
  }

  if (!data?.value) {
    return { ...DEFAULT_SETTINGS }
  }

  let parsed: unknown = null
  try {
    parsed = JSON.parse(String(data.value))
  } catch {
    parsed = null
  }

  const normalized = parseStoredSettings(parsed)
  return {
    ...DEFAULT_SETTINGS,
    ...normalized,
    updatedAt: normalizeText(normalized.updatedAt) || normalizeText(data.updated_at) || null,
  }
}

export async function saveBlogGeneratorSettings(
  supabase: ServiceSupabase,
  settings: BlogGeneratorSettings,
): Promise<BlogGeneratorSettings> {
  const nowIso = new Date().toISOString()
  const stored = {
    ...settings,
    mediaPolicy: BLOG_GENERATION_MEDIA_POLICY,
    updatedAt: nowIso,
  }

  const payload = {
    key: BLOG_GENERATION_SETTINGS_KEY,
    value: JSON.stringify(stored),
    value_type: "json",
    description: "Admin-controlled inputs for AI blog generation (topic, keyword pack, instructions, and daily toggle).",
    is_public: false,
    category: "blog",
    updated_at: nowIso,
  }

  const { error } = await supabase.from("platform_config").upsert(payload, { onConflict: "key" })
  if (error) {
    throw new Error(`Failed to save blog generator settings: ${error.message}`)
  }

  return stored
}

export function toBlogGenerationOverrides(settings: BlogGeneratorSettings): BlogGenerationOverrides {
  return {
    topic: settings.topic || undefined,
    primaryKeyword: settings.primaryKeyword || undefined,
    secondaryKeywords: settings.secondaryKeywords,
    longTailQuestions: settings.longTailQuestions,
    customInstructions: settings.customInstructions || undefined,
  }
}
