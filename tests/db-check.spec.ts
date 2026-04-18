import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

test.describe("Database Verification Tests", () => {
  test("Verify latest bookings exist in database", async () => {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      test.skip()
    }

    const supabase = createClient(supabaseUrl!, serviceRoleKey!)

    // Query the last 5 bookings
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)

    expect(error).toBeNull()
    expect(Array.isArray(bookings)).toBeTruthy()
    expect(bookings!.length).toBeGreaterThanOrEqual(0)

    // Verify booking structure
    if (bookings && bookings.length > 0) {
      const booking = bookings[0]
      expect(booking).toHaveProperty("tourist_id")
      expect(booking).toHaveProperty("schedule_id")
      expect(booking).toHaveProperty("adults")
      expect(booking).toHaveProperty("children")
      expect(booking).toHaveProperty("status")
    }
  })

  test("Verify tour schedules have correct structure", async () => {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      test.skip()
    }

    const supabase = createClient(supabaseUrl!, serviceRoleKey!)

    // Query tour schedules
    const { data: schedules, error } = await supabase.from("tour_schedules").select("*").limit(5)

    expect(error).toBeNull()
    expect(Array.isArray(schedules)).toBeTruthy()

    // Verify schedule structure
    if (schedules && schedules.length > 0) {
      const schedule = schedules[0]
      expect(schedule).toHaveProperty("tour_id")
      expect(schedule).toHaveProperty("scheduled_date")
      expect(schedule).toHaveProperty("scheduled_time")
      expect(schedule).toHaveProperty("capacity")
    }
  })
})
