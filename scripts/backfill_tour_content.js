#!/usr/bin/env node

require("dotenv").config({ path: ".env.local" })
require("dotenv").config()

const { createClient } = require("@supabase/supabase-js")

const LEGACY_FILLER_FRAGMENT = "connects history, local life, and practical travel tips"

const HIGHLIGHT_SYSTEM_PROMPT =
  'You write highlight descriptions for walking tour stops in cities around the world. Even if the guide description is brief, use your own knowledge of the landmark combined with any context provided. Be specific, vivid, and story-driven. Never use generic phrases like "connects history, local life, and practical travel tips". Sound like a knowledgeable local friend, not a brochure. Under 30 words.'

const ROUTE_SNAPSHOT_SYSTEM_PROMPT =
  "You write route snapshot entries for walking tour pages. Be factual, brief, and practical. No storytelling, no emotion. Just what it is and where it sits on the route."

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
}

function truncateAtWord(value, maxLength) {
  const normalized = normalizeText(value)
  if (normalized.length <= maxLength) return normalized

  const sliced = normalized.slice(0, maxLength + 1)
  const cut = sliced.lastIndexOf(" ")
  if (cut > Math.floor(maxLength * 0.6)) {
    return sliced.slice(0, cut).trim()
  }

  return normalized.slice(0, maxLength).trim()
}

function ensureCompleteSentence(value, maxLength) {
  const normalized = normalizeText(value)
  if (!normalized) return normalized

  let candidate = normalized.length > maxLength ? truncateAtWord(normalized, maxLength) : normalized
  candidate = candidate.replace(/[\s,;:–—-]+$/, "").trim()

  if (normalized.length > maxLength && !/[.!?]$/.test(candidate)) {
    const lastClauseBreak = Math.max(candidate.lastIndexOf(","), candidate.lastIndexOf(";"), candidate.lastIndexOf(":"))
    if (lastClauseBreak > Math.floor(candidate.length * 0.5)) {
      candidate = candidate.slice(0, lastClauseBreak).trim()
    }
  }

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

function isBlank(value) {
  return normalizeText(value).length === 0
}

function containsLegacyFiller(value) {
  return normalizeText(value).toLowerCase().includes(LEGACY_FILLER_FRAGMENT)
}

function buildPromptPayload({ neighbourhood, city, guideDescription, stopName, googleContext }) {
  return [
    `Tour neighbourhood: ${neighbourhood || city}`,
    `City: ${city}`,
    `Guide's tour description: ${guideDescription || ""}`,
    `Stop name: ${stopName}`,
    `Google context: ${googleContext || ""}`,
  ].join("\n")
}

function buildRouteSnapshotFallback(stopName, city) {
  const stop = normalizeText(stopName) || "This stop"
  const cityName = normalizeText(city) || "the city"
  return truncateAtWord(`${stop} is a key landmark stop on this ${cityName} route.`, 120)
}

function buildHighlightFallback(stopName, city) {
  const stop = normalizeText(stopName) || "This stop"
  const cityName = normalizeText(city) || "this city"
  return truncateAtWord(`${stop} reveals how ${cityName}'s past still shapes the streets you walk today.`, 120)
}

async function callOpenAiText(systemPrompt, userPrompt) {
  const apiKey = normalizeText(process.env.OPENAI_API_KEY)
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
  if (!normalized) throw new Error("OPENAI_EMPTY_RESPONSE")

  return normalized
}

async function fetchGoogleContext(stopName, city) {
  const apiKey = normalizeText(process.env.GOOGLE_PLACES_API_KEY)
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

async function generateHighlightText(input) {
  const userPrompt =
    `${buildPromptPayload(input)}\n\n` +
    "Write ONE highlight description for this stop. Under 30 words. Emotional and story-driven. Make a traveller want to see it."

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

async function generateRouteSnapshotText(input) {
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

function getGuideFirstName(fullName) {
  const normalized = normalizeText(fullName)
  if (!normalized) return "your guide"
  return normalized.split(" ")[0] || "your guide"
}

function deriveNeighbourhood(tourTitle, city, stopNames) {
  const cityLabel = normalizeText(city)
  const title = normalizeText(tourTitle)

  const cleanedTitle = title
    .replace(/\bfree\b/gi, "")
    .replace(/\bwalking\s+tour\b/gi, "")
    .replace(/\btour\b/gi, "")
    .replace(/\bin\s+[a-z\s-]+$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()

  if (cleanedTitle && cleanedTitle.toLowerCase() !== cityLabel.toLowerCase()) {
    return cleanedTitle
  }

  const stopDerived = (stopNames || [])
    .map((name) => normalizeText(name))
    .find((name) => {
      if (!name) return false
      const lower = name.toLowerCase()
      const cityLower = cityLabel.toLowerCase()
      return !cityLower || !lower.includes(cityLower)
    })

  if (stopDerived) return stopDerived.split(",")[0].trim()

  return cityLabel || "city centre"
}

function buildAutoSeoTitle({ neighbourhood, city }) {
  const neighbourhoodText = normalizeText(neighbourhood)
  const cityText = normalizeText(city)
  const base = `${neighbourhoodText} Walking Tour ${cityText} — Free, Tip at End`
  if (base.length <= 60) return base
  return truncateAtWord(`${neighbourhoodText} Walking Tour ${cityText}`, 60)
}

function buildAutoSeoMetaDescription({ neighbourhood, guideFirstName, stopNames, maxGuests }) {
  const neighbourhoodText = normalizeText(neighbourhood)
  const guideText = normalizeText(guideFirstName) || "your guide"
  const topStops = (stopNames || []).map((stop) => normalizeText(stop)).filter(Boolean).slice(0, 3)
  const stopsPart = topStops.length > 0 ? topStops.join(", ") : "top local landmarks"
  const base = `Free ${neighbourhoodText} walking tour with ${guideText} — ${stopsPart}. Max ${Math.max(1, Number(maxGuests || 1))} guests. Book free, tip at the end.`
  return truncateAtWord(base, 155)
}

async function upsertStopContent(supabase, stop, tour, options = {}) {
  const forceHighlight = Boolean(options.forceHighlight)
  const forceSnapshot = Boolean(options.forceSnapshot)

  if (!tour) return false

  const highlightOverridden = Boolean(stop.highlight_manually_overridden)
  const snapshotOverridden = Boolean(stop.route_snapshot_manually_overridden)
  const shouldGenerateHighlight = !highlightOverridden && (forceHighlight || isBlank(stop.highlight))
  const shouldGenerateSnapshot = !snapshotOverridden && (forceSnapshot || isBlank(stop.route_snapshot))

  if (!shouldGenerateHighlight && !shouldGenerateSnapshot) {
    return false
  }

  const stopName = normalizeText(stop.stop_name)
  const city = normalizeText(tour.city) || "Paris"
  const neighbourhood = deriveNeighbourhood(tour.title, city, [stopName])
  const googleContext = normalizeText(stop.google_context) || (await fetchGoogleContext(stopName, city))

  const input = {
    city,
    neighbourhood,
    guideDescription: normalizeText(tour.description),
    stopName,
    googleContext,
  }

  const nextHighlight = shouldGenerateHighlight ? await generateHighlightText(input) : normalizeText(stop.highlight)
  const nextSnapshot = shouldGenerateSnapshot
    ? await generateRouteSnapshotText(input)
    : normalizeText(stop.route_snapshot)

  const payload = {
    google_context: googleContext || null,
    updated_at: new Date().toISOString(),
  }

  if (shouldGenerateHighlight) payload.highlight = nextHighlight || null
  if (shouldGenerateSnapshot) payload.route_snapshot = nextSnapshot || null

  const { error } = await supabase.from("tour_stops").update(payload).eq("id", stop.id)
  if (error) {
    throw new Error(`STOP_UPDATE_FAILED(${stop.id}): ${error.message}`)
  }

  console.log(
    `[stop] ${tour.title} :: #${stop.position} ${stop.stop_name}\n` +
      `  highlight: ${shouldGenerateHighlight ? nextHighlight : "(kept)"}\n` +
      `  route_snapshot: ${shouldGenerateSnapshot ? nextSnapshot : "(kept)"}`,
  )

  return true
}

async function backfillLegacyStops(supabase) {
  const { data: allStops, error } = await supabase
    .from("tour_stops")
    .select(
      "id, tour_id, position, stop_name, highlight, route_snapshot, google_context, highlight_manually_overridden, route_snapshot_manually_overridden",
    )
    .order("tour_id", { ascending: true })
    .order("position", { ascending: true })

  if (error) throw new Error(`FILLER_STOPS_QUERY_FAILED: ${error.message}`)

  const scannedTotal = Array.isArray(allStops) ? allStops.length : 0
  const targetStops = (allStops || []).filter((stop) => {
    const highlight = normalizeText(stop.highlight)
    const routeSnapshot = normalizeText(stop.route_snapshot)
    return (
      isBlank(highlight) ||
      isBlank(routeSnapshot) ||
      containsLegacyFiller(highlight) ||
      containsLegacyFiller(routeSnapshot)
    )
  })

  if (targetStops.length === 0) {
    console.log("[backfill] No missing or legacy-filler stops found.")
    return { scanned_total: scannedTotal, matched_missing_or_filler: 0, updated: 0 }
  }

  const tourIds = [...new Set(targetStops.map((stop) => stop.tour_id).filter(Boolean))]
  const { data: tours, error: tourError } = await supabase
    .from("tours")
    .select("id, title, city, description")
    .in("id", tourIds)

  if (tourError) throw new Error(`FILLER_TOURS_QUERY_FAILED: ${tourError.message}`)

  const tourMap = new Map((tours || []).map((tour) => [tour.id, tour]))
  let updated = 0
  for (const stop of targetStops) {
    const tour = tourMap.get(stop.tour_id)
    if (!tour) continue
    const changed = await upsertStopContent(supabase, stop, tour, { forceHighlight: true, forceSnapshot: true })
    if (changed) updated += 1
  }

  return { scanned_total: scannedTotal, matched_missing_or_filler: targetStops.length, updated }
}

async function regenerateCityOfLightsStops(supabase) {
  const { data: cityTours, error: cityTourError } = await supabase
    .from("tours")
    .select("id, title, city, description")
    .ilike("title", "City of Lights Walking Tour")

  if (cityTourError) throw new Error(`CITY_OF_LIGHTS_QUERY_FAILED: ${cityTourError.message}`)

  if (!Array.isArray(cityTours) || cityTours.length === 0) {
    console.log("[city-of-lights] Tour not found, skipping forced regeneration.")
    return { scanned: 0, updated: 0 }
  }

  let scanned = 0
  let updated = 0

  for (const tour of cityTours) {
    const { data: stops, error: stopsError } = await supabase
      .from("tour_stops")
      .select(
        "id, tour_id, position, stop_name, highlight, route_snapshot, google_context, highlight_manually_overridden, route_snapshot_manually_overridden",
      )
      .eq("tour_id", tour.id)
      .order("position", { ascending: true })

    if (stopsError) throw new Error(`CITY_OF_LIGHTS_STOPS_QUERY_FAILED(${tour.id}): ${stopsError.message}`)

    for (const stop of stops || []) {
      scanned += 1
      const changed = await upsertStopContent(supabase, stop, tour, { forceHighlight: true, forceSnapshot: true })
      if (changed) updated += 1
    }
  }

  return { scanned, updated }
}

async function backfillSeoFields(supabase) {
  const { data: tours, error } = await supabase
    .from("tours")
    .select(
      "id, title, city, description, max_capacity, highlights, seo_title, seo_meta_description, seo_title_manually_overridden, seo_meta_description_manually_overridden, guide:guide_id(full_name), tour_stops(position, stop_name)",
    )

  if (error) throw new Error(`SEO_QUERY_FAILED: ${error.message}`)

  let scanned = 0
  let updated = 0

  for (const tour of tours || []) {
    const missingSeoTitle = isBlank(tour.seo_title)
    const missingSeoMeta = isBlank(tour.seo_meta_description)
    if (!missingSeoTitle && !missingSeoMeta) continue

    scanned += 1

    const stopsFromTourStops = Array.isArray(tour.tour_stops)
      ? [...tour.tour_stops]
          .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
          .map((stop) => normalizeText(stop.stop_name))
          .filter(Boolean)
      : []
    const stopsFallback = Array.isArray(tour.highlights) ? tour.highlights.map((value) => normalizeText(value)).filter(Boolean) : []
    const stopNames = stopsFromTourStops.length > 0 ? stopsFromTourStops : stopsFallback
    const guideRecord = Array.isArray(tour.guide) ? tour.guide[0] : tour.guide
    const guideFirstName = getGuideFirstName(guideRecord?.full_name)
    const neighbourhood = deriveNeighbourhood(tour.title, tour.city, stopNames)

    const payload = {}

    if (!tour.seo_title_manually_overridden && missingSeoTitle) {
      payload.seo_title = buildAutoSeoTitle({
        neighbourhood,
        city: normalizeText(tour.city),
      })
    }

    if (!tour.seo_meta_description_manually_overridden && missingSeoMeta) {
      payload.seo_meta_description = buildAutoSeoMetaDescription({
        neighbourhood,
        guideFirstName,
        stopNames,
        maxGuests: Number(tour.max_capacity || 10),
      })
    }

    if (Object.keys(payload).length === 0) continue

    const { error: updateError } = await supabase.from("tours").update(payload).eq("id", tour.id)
    if (updateError) throw new Error(`SEO_UPDATE_FAILED(${tour.id}): ${updateError.message}`)

    updated += 1
    console.log(
      `[tour] ${tour.title}\n` +
        `  seo_title: ${payload.seo_title ? payload.seo_title : "(kept)"}\n` +
        `  seo_meta_description: ${payload.seo_meta_description ? payload.seo_meta_description : "(kept)"}`,
    )
  }

  return { scanned, updated }
}

async function main() {
  const supabaseUrl = normalizeText(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRoleKey = normalizeText(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log("[backfill] Starting tour content backfill...")

  const fillerResult = await backfillLegacyStops(supabase)
  const cityOfLightsResult = await regenerateCityOfLightsStops(supabase)
  const seoResult = await backfillSeoFields(supabase)

  console.log("[backfill] Done.")
  console.log(
    JSON.stringify(
      {
        fillerStops: fillerResult,
        cityOfLights: cityOfLightsResult,
        seo: seoResult,
      },
      null,
      2,
    ),
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[backfill] Failed:", error)
    process.exit(1)
  })
