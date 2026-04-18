const LEGACY_FILLER_FRAGMENT = "connects history, local life, and practical travel tips"

const HIGHLIGHT_SYSTEM_PROMPT =
  "You write highlight descriptions for walking tour stops in cities around the world. Even if the guide description is brief, use your own knowledge of the landmark combined with any context provided. Be specific, vivid, and story-driven. Never use generic phrases like \"connects history, local life, and practical travel tips\". Sound like a knowledgeable local friend, not a brochure. Under 30 words."

const ROUTE_SNAPSHOT_SYSTEM_PROMPT =
  "You write route snapshot entries for walking tour pages. Be factual, brief, and practical. No storytelling, no emotion. Just what it is and where it sits on the route."

type StopGenerationInput = {
  city: string
  neighbourhood: string
  guideDescription: string
  stopName: string
  googleContext: string
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
}

function truncateAtWord(value: string, maxLength: number): string {
  const normalized = normalizeText(value)
  if (normalized.length <= maxLength) return normalized

  const sliced = normalized.slice(0, maxLength + 1)
  const cut = sliced.lastIndexOf(" ")
  if (cut > Math.floor(maxLength * 0.6)) {
    return sliced.slice(0, cut).trim()
  }

  return normalized.slice(0, maxLength).trim()
}

function ensureCompleteSentence(value: string, maxLength: number): string {
  const normalized = normalizeText(value)
  if (!normalized) return normalized

  let candidate = normalized.length > maxLength ? truncateAtWord(normalized, maxLength) : normalized
  candidate = candidate.replace(/[\s,;:–—-]+$/, "").trim()

  // If the snippet is clipped and lacks terminal punctuation, prefer trimming to the last clause break.
  if (normalized.length > maxLength && !/[.!?]$/.test(candidate)) {
    const lastClauseBreak = Math.max(candidate.lastIndexOf(","), candidate.lastIndexOf(";"), candidate.lastIndexOf(":"))
    if (lastClauseBreak > Math.floor(candidate.length * 0.5)) {
      candidate = candidate.slice(0, lastClauseBreak).trim()
    }
  }

  // Avoid visibly cut-off endings like "... and." or "... the."
  const weakEnding =
    /\b(?:a|an|the|and|or|but|of|to|in|on|at|for|from|with|by|into|onto|up|down|over|under|through|between|against|among|around|about|as|than|that|which|who|whom|whose|while|where|when)\.?$/i
  while (weakEnding.test(candidate) && candidate.length > 24) {
    candidate = candidate.replace(weakEnding, "").replace(/[\s,;:–—-]+$/, "").trim()
  }

  const firstSentenceMatch = normalized.match(/^[\s\S]*?[.!?](?=\s|$)/)
  const firstSentence = normalizeText(firstSentenceMatch?.[0] || "")
  if (firstSentence && firstSentence.length <= maxLength && firstSentence.length >= 20) {
    return firstSentence
  }

  if (!/[.!?]$/.test(candidate)) {
    candidate = `${candidate}.`
  }

  return candidate
}

export function containsLegacyFiller(value: string | null | undefined): boolean {
  return normalizeText(value).toLowerCase().includes(LEGACY_FILLER_FRAGMENT)
}

export function buildRouteSnapshotFallback(stopName: string, city: string): string {
  const stop = normalizeText(stopName) || "This stop"
  const cityName = normalizeText(city) || "the city"
  return truncateAtWord(`${stop} is a key landmark stop on this ${cityName} route.`, 120)
}

export function buildHighlightFallback(stopName: string, city: string): string {
  const stop = normalizeText(stopName) || "This stop"
  const cityName = normalizeText(city) || "this city"
  return truncateAtWord(`${stop} reveals how ${cityName}'s past still shapes the streets you walk today.`, 120)
}

function buildPromptPayload(input: StopGenerationInput): string {
  return [
    `Tour neighbourhood: ${input.neighbourhood || input.city}`,
    `City: ${input.city}`,
    `Guide's tour description: ${input.guideDescription || ""}`,
    `Stop name: ${input.stopName}`,
    `Google context: ${input.googleContext || ""}`,
  ].join("\n")
}

async function callOpenAiText(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING")
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 120,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`OPENAI_REQUEST_FAILED: ${response.status} ${payload}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const normalized = normalizeText(content)
  if (!normalized) {
    throw new Error("OPENAI_EMPTY_RESPONSE")
  }

  return normalized
}

export async function fetchGoogleContext(stopName: string, city: string): Promise<string> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim()
  if (!apiKey) return ""

  const query = normalizeText(`${stopName} ${city}`)
  if (!query) return ""

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
  url.searchParams.set("query", query)
  url.searchParams.set("key", apiKey)

  const response = await fetch(url.toString(), { method: "GET" })
  if (!response.ok) return ""

  const payload = await response.json()
  const firstResult = Array.isArray(payload?.results) ? payload.results[0] : null
  if (!firstResult) return ""

  const overview = normalizeText(firstResult?.editorial_summary?.overview)
  if (overview) return overview

  return normalizeText(firstResult?.formatted_address)
}

export async function generateHighlightText(input: StopGenerationInput): Promise<string> {
  const userPrompt = `${buildPromptPayload(input)}\n\nWrite ONE highlight description for this stop. Under 30 words. Emotional and story-driven. Make a traveller want to see it.`

  try {
    const generated = await callOpenAiText(HIGHLIGHT_SYSTEM_PROMPT, userPrompt)
    const withoutLegacyPhrase = generated
      .replace(/connects history, local life, and practical travel tips/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()

    return ensureCompleteSentence(withoutLegacyPhrase || buildHighlightFallback(input.stopName, input.city), 120)
  } catch {
    return buildHighlightFallback(input.stopName, input.city)
  }
}

export async function generateRouteSnapshotText(input: StopGenerationInput): Promise<string> {
  const userPrompt = [
    `Stop name: ${input.stopName}`,
    `City: ${input.city}`,
    `Neighbourhood: ${input.neighbourhood || input.city}`,
    `Google context: ${input.googleContext || ""}`,
    "",
    "Write ONE route snapshot entry for this stop. Under 20 words. Factual only — what it is, nothing emotional.",
  ].join("\n")

  try {
    const generated = await callOpenAiText(ROUTE_SNAPSHOT_SYSTEM_PROMPT, userPrompt)
    return ensureCompleteSentence(generated, 110)
  } catch {
    return buildRouteSnapshotFallback(input.stopName, input.city)
  }
}

export type TourStopRow = {
  id: string
  tour_id: string
  position: number
  stop_name: string
  highlight: string | null
  route_snapshot: string | null
  google_context: string | null
  highlight_manually_overridden: boolean | null
  route_snapshot_manually_overridden: boolean | null
}

export async function refreshGeneratedStopContent(options: {
  supabase: any
  tourId: string
  city: string
  neighbourhood: string
  guideDescription: string
  stops: TourStopRow[]
  forceHighlightRegeneration?: boolean
}): Promise<TourStopRow[]> {
  const {
    supabase,
    city,
    neighbourhood,
    guideDescription,
    stops,
    forceHighlightRegeneration = false,
  } = options

  const sortedStops = [...(stops || [])].sort((a, b) => Number(a.position || 0) - Number(b.position || 0))

  for (const stop of sortedStops) {
    const highlightOverridden = Boolean(stop.highlight_manually_overridden)
    const snapshotOverridden = Boolean(stop.route_snapshot_manually_overridden)

    const shouldGenerateHighlight =
      !highlightOverridden &&
      (forceHighlightRegeneration || !normalizeText(stop.highlight) || containsLegacyFiller(stop.highlight))

    const shouldGenerateSnapshot =
      !snapshotOverridden &&
      (!normalizeText(stop.route_snapshot) || containsLegacyFiller(stop.route_snapshot))

    if (!shouldGenerateHighlight && !shouldGenerateSnapshot) {
      continue
    }

    const googleContext = normalizeText(stop.google_context) || (await fetchGoogleContext(stop.stop_name, city))

    const input: StopGenerationInput = {
      city,
      neighbourhood,
      guideDescription,
      stopName: stop.stop_name,
      googleContext,
    }

    const nextHighlight = shouldGenerateHighlight
      ? await generateHighlightText(input)
      : normalizeText(stop.highlight)

    const nextRouteSnapshot = shouldGenerateSnapshot
      ? await generateRouteSnapshotText(input)
      : normalizeText(stop.route_snapshot)

    const updatePayload: Record<string, unknown> = {
      google_context: googleContext || null,
      updated_at: new Date().toISOString(),
    }

    if (shouldGenerateHighlight) {
      updatePayload.highlight = nextHighlight || null
    }

    if (shouldGenerateSnapshot) {
      updatePayload.route_snapshot = nextRouteSnapshot || null
    }

    const { error } = await supabase
      .from("tour_stops")
      .update(updatePayload)
      .eq("id", stop.id)

    if (!error) {
      stop.highlight = shouldGenerateHighlight ? nextHighlight : stop.highlight
      stop.route_snapshot = shouldGenerateSnapshot ? nextRouteSnapshot : stop.route_snapshot
      stop.google_context = googleContext || null
    }
  }

  return sortedStops
}
