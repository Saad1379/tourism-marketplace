/**
 * Tour resource adapter.
 *
 * Bridges the shared booking engine to the existing tour_schedules / tours tables.
 * All the tour-specific logic (credit deduction, email, QR sessions) lives here,
 * keeping the booking engine itself resource-agnostic.
 */

import type { ResourceAdapter } from "../resource-adapter"
import type { BookingSlot } from "../types"

export const tourAdapter: ResourceAdapter = {
  resourceType: "tour",

  async getSlot(scheduleId: string, supabase: any): Promise<BookingSlot | null> {
    const { data, error } = await supabase
      .from("tour_schedules")
      .select("id, tour_id, start_time, capacity, booked_count")
      .eq("id", scheduleId)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      resource_id: data.tour_id,
      resource_type: "tour",
      start_time: data.start_time,
      capacity: data.capacity ?? 10,
      booked_count: data.booked_count ?? 0,
    }
  },

  async isSeller(resourceId: string, userId: string, supabase: any): Promise<boolean> {
    const { data } = await supabase
      .from("tours")
      .select("guide_id")
      .eq("id", resourceId)
      .single()
    return data?.guide_id === userId
  },

  async getSellerId(resourceId: string, supabase: any): Promise<string | null> {
    const { data } = await supabase
      .from("tours")
      .select("guide_id")
      .eq("id", resourceId)
      .single()
    return data?.guide_id ?? null
  },

  async onBookingCreated({ bookingId, resourceId, supabase }): Promise<void> {
    // Non-blocking: no credits deduction needed for the free-tip model
    // Email sending is handled by the POST route directly (needs profile data)
    // Future: move email logic here
  },

  async onBookingCancelled({ bookingId, supabase }): Promise<void> {
    // Credits refund trigger is handled by a DB trigger on the bookings table
    // No additional action needed here
  },
}
