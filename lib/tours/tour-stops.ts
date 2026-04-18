import { deriveNeighbourhood } from "@/lib/tours/seo-autogen"
import { refreshGeneratedStopContent, type TourStopRow } from "@/lib/tours/stop-content"

function normalizeStopName(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
}

export function sanitizeStopNames(values: unknown[]): string[] {
  if (!Array.isArray(values)) return []
  return values
    .map((value) => normalizeStopName(value))
    .filter(Boolean)
}

export async function listTourStops(supabase: any, tourId: string): Promise<TourStopRow[]> {
  const { data, error } = await supabase
    .from("tour_stops")
    .select(
      "id, tour_id, position, stop_name, highlight, route_snapshot, google_context, highlight_manually_overridden, route_snapshot_manually_overridden",
    )
    .eq("tour_id", tourId)
    .order("position", { ascending: true })

  if (error || !Array.isArray(data)) {
    return []
  }

  return data as TourStopRow[]
}

async function deleteStopsAfterPosition(supabase: any, tourId: string, maxPosition: number) {
  const { error } = await supabase.from("tour_stops").delete().eq("tour_id", tourId).gt("position", maxPosition)
  if (error) {
    // Ignore missing table / relation errors for safe compatibility rollout.
    if (!String(error.message || "").toLowerCase().includes("relation")) {
      throw error
    }
  }
}

async function upsertStopRow(
  supabase: any,
  current: TourStopRow | undefined,
  tourId: string,
  position: number,
  stopName: string,
) {
  if (!current) {
    const { error } = await supabase.from("tour_stops").insert({
      tour_id: tourId,
      position,
      stop_name: stopName,
      highlight: null,
      route_snapshot: null,
      google_context: null,
    })

    if (error) {
      throw error
    }
    return
  }

  const stopNameChanged = normalizeStopName(current.stop_name) !== stopName
  const payload: Record<string, unknown> = {
    stop_name: stopName,
    updated_at: new Date().toISOString(),
  }

  if (stopNameChanged) {
    if (!Boolean(current.highlight_manually_overridden)) {
      payload.highlight = null
      payload.google_context = null
    }
    if (!Boolean(current.route_snapshot_manually_overridden)) {
      payload.route_snapshot = null
    }
  }

  const { error } = await supabase.from("tour_stops").update(payload).eq("id", current.id)
  if (error) {
    throw error
  }
}

export async function syncTourStopsFromHighlights(options: {
  supabase: any
  tourId: string
  highlights: unknown[]
}): Promise<TourStopRow[]> {
  const { supabase, tourId } = options
  const stopNames = sanitizeStopNames(Array.isArray(options.highlights) ? options.highlights : [])
  if (!tourId) return []

  try {
    const existingStops = await listTourStops(supabase, tourId)
    const existingByPosition = new Map<number, TourStopRow>()
    for (const row of existingStops) {
      existingByPosition.set(Number(row.position || 0), row)
    }

    for (let index = 0; index < stopNames.length; index += 1) {
      const position = index + 1
      const stopName = stopNames[index]
      const existing = existingByPosition.get(position)
      await upsertStopRow(supabase, existing, tourId, position, stopName)
    }

    await deleteStopsAfterPosition(supabase, tourId, stopNames.length)
    return await listTourStops(supabase, tourId)
  } catch (error) {
    const message = String((error as { message?: string })?.message || "")
    // During staged rollout, avoid hard failures if DB migration is not yet applied.
    if (message.toLowerCase().includes("tour_stops") || message.toLowerCase().includes("relation")) {
      return []
    }
    throw error
  }
}

export async function syncAndRefreshTourStopContent(options: {
  supabase: any
  tourId: string
  city: string
  neighbourhood?: string | null
  guideDescription: string
  highlights: unknown[]
  forceHighlightRegeneration?: boolean
}): Promise<TourStopRow[]> {
  const {
    supabase,
    tourId,
    city,
    neighbourhood,
    guideDescription,
    highlights,
    forceHighlightRegeneration = false,
  } = options

  const syncedStops = await syncTourStopsFromHighlights({
    supabase,
    tourId,
    highlights,
  })

  if (syncedStops.length === 0) return []

  const stopNames = syncedStops.map((row) => normalizeStopName(row.stop_name)).filter(Boolean)
  const resolvedNeighbourhood =
    normalizeStopName(neighbourhood) || deriveNeighbourhood(null, city, stopNames) || normalizeStopName(city)

  return refreshGeneratedStopContent({
    supabase,
    tourId,
    city,
    neighbourhood: resolvedNeighbourhood,
    guideDescription,
    stops: syncedStops,
    forceHighlightRegeneration,
  })
}

