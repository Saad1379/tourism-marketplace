import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tourId = searchParams.get("tour_id")

    if (!tourId) {
      return NextResponse.json({ error: "tour_id is required" }, { status: 400 })
    }

    const { data: schedules, error } = await supabase
      .from("tour_schedules")
      .select("*")
      .eq("tour_id", tourId)
      .order("start_time", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching schedules:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(schedules || [])
  } catch (error) {
    console.error("[v0] Unexpected error in GET /api/schedules:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure profile exists
    if (!user.email) {
      return NextResponse.json({ error: "User email missing" }, { status: 400 })
    }
    const profile = await ensureProfile(supabase, user as any)
    if (!profile) {
      return NextResponse.json({ error: "Failed to access or create profile" }, { status: 500 })
    }

    const body = await request.json()
    const { tour_id, start_time, capacity, language, schedules: bulkSchedules } = body

    if (!tour_id) {
      return NextResponse.json({ error: "tour_id is required" }, { status: 400 })
    }

    // Verify the user owns this tour
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select("guide_id")
      .eq("id", tour_id)
      .single()

    if (tourError || !tour) {
      return NextResponse.json({ error: "Tour not found" }, { status: 404 })
    }

    if (tour.guide_id !== user.id) {
      return NextResponse.json({ error: "You can only add schedules to your own tours" }, { status: 403 })
    }

    // Handle bulk insert
    if (bulkSchedules && Array.isArray(bulkSchedules)) {
      // Validate all schedules have required fields
      const validSchedules = bulkSchedules.filter((s: any) => {
        if (!s.start_time) {
          console.error("[v0] Schedule missing start_time:", s)
          return false
        }
        if (!Number.isInteger(s.capacity) || s.capacity <= 0) {
          console.error("[v0] Schedule has invalid capacity:", s)
          return false
        }
        return true
      })

      if (validSchedules.length === 0) {
        return NextResponse.json(
          { error: "No valid schedules provided" },
          { status: 400 }
        )
      }

      const schedulesToInsert = validSchedules.map((s: any) => ({
        tour_id,
        start_time: s.start_time,
        capacity: parseInt(s.capacity.toString()),
        language: s.language || "English",
        booked_count: 0,
      }))

      // Try with language column first
      let { data: inserted, error: insertError } = await supabase
        .from("tour_schedules")
        .insert(schedulesToInsert)
        .select()

      // If language column doesn't exist, retry without it
      if (insertError && insertError.message.includes("language")) {
        const schedulesWithoutLang = schedulesToInsert.map(({ language, ...rest }) => rest)
        const { data: inserted2, error: insertError2 } = await supabase
          .from("tour_schedules")
          .insert(schedulesWithoutLang)
          .select()

        if (insertError2) {
          console.error("[v0] Error creating schedules (without language):", insertError2)
          return NextResponse.json(
            { error: insertError2.message, insertedCount: 0 },
            { status: 500 }
          )
        }

        const insertedCount = Array.isArray(inserted2) ? inserted2.length : 0
        if (insertedCount === 0) {
          return NextResponse.json(
            { error: "Failed to insert schedules - no rows created", insertedCount: 0 },
            { status: 500 }
          )
        }

        return NextResponse.json(
          { insertedCount, rows: inserted2 },
          { status: 201 }
        )
      }

      if (insertError) {
        console.error("[v0] Error creating schedules:", insertError)
        return NextResponse.json(
          { error: insertError.message, insertedCount: 0 },
          { status: 500 }
        )
      }

      const insertedCount = Array.isArray(inserted) ? inserted.length : 0
      if (insertedCount === 0) {
        return NextResponse.json(
          { error: "Failed to insert schedules - no rows created", insertedCount: 0 },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { insertedCount, rows: inserted },
        { status: 201 }
      )
    }

    // Single schedule insert (backward compatibility)
    if (!start_time) {
      return NextResponse.json({ error: "start_time is required" }, { status: 400 })
    }

    const { data: schedule, error } = await supabase
      .from("tour_schedules")
      .insert({
        tour_id,
        start_time,
        capacity: capacity || 10,
        language: language || "English",
        booked_count: 0,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating schedule:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Unexpected error in POST /api/schedules:", errMsg, error)
    return NextResponse.json({ error: `Server error: ${errMsg}` }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get("id")

    if (!scheduleId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Verify ownership via tour
    const { data: schedule, error: fetchError } = await supabase
      .from("tour_schedules")
      .select("tour_id, tours(guide_id)")
      .eq("id", scheduleId)
      .single()

    if (fetchError || !schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    const tourData = (schedule.tours as any) as { guide_id: string } | null
    if (tourData?.guide_id !== user.id) {
      return NextResponse.json({ error: "You can only delete your own schedules" }, { status: 403 })
    }

    const { error } = await supabase
      .from("tour_schedules")
      .delete()
      .eq("id", scheduleId)

    if (error) {
      console.error("[v0] Error deleting schedule:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Unexpected error in DELETE /api/schedules:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, start_time, capacity, language } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Verify ownership via tour
    const { data: schedule, error: fetchError } = await supabase
      .from("tour_schedules")
      .select("tour_id, tours(guide_id)")
      .eq("id", id)
      .single()

    if (fetchError || !schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    const tourData = (schedule.tours as any) as { guide_id: string } | null
    if (tourData?.guide_id !== user.id) {
      return NextResponse.json({ error: "You can only update your own schedules" }, { status: 403 })
    }

    const updatePayload: any = {}
    if (start_time) updatePayload.start_time = start_time
    if (capacity) updatePayload.capacity = parseInt(capacity.toString())
    if (language) updatePayload.language = language

    const { data: updated, error } = await supabase
      .from("tour_schedules")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating schedule:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Unexpected error in PATCH /api/schedules:", errMsg, error)
    return NextResponse.json({ error: `Server error: ${errMsg}` }, { status: 500 })
  }
}
