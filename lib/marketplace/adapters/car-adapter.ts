/**
 * Car resource adapter.
 *
 * Bridges the shared booking engine to the cars / car_schedules tables.
 */

import type { ResourceAdapter } from "../resource-adapter"
import type { BookingSlot } from "../types"

export const carAdapter: ResourceAdapter = {
  resourceType: "car",

  async getSlot(scheduleId: string, supabase: any): Promise<BookingSlot | null> {
    const { data, error } = await supabase
      .from("car_schedules")
      .select("id, car_id, start_time, end_time, capacity, booked_count")
      .eq("id", scheduleId)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      resource_id: data.car_id,
      resource_type: "car",
      start_time: data.start_time,
      end_time: data.end_time ?? null,
      capacity: data.capacity ?? 1,
      booked_count: data.booked_count ?? 0,
    }
  },

  async isSeller(resourceId: string, userId: string, supabase: any): Promise<boolean> {
    const { data } = await supabase
      .from("cars")
      .select("seller_id")
      .eq("id", resourceId)
      .single()
    return data?.seller_id === userId
  },

  async getSellerId(resourceId: string, supabase: any): Promise<string | null> {
    const { data } = await supabase
      .from("cars")
      .select("seller_id")
      .eq("id", resourceId)
      .single()
    return data?.seller_id ?? null
  },

  async onBookingCreated({ bookingId, resourceId, supabase }): Promise<void> {
    // Future: send car booking confirmation email
  },

  async onBookingCancelled({ bookingId, supabase }): Promise<void> {
    // Future: handle car booking cancellation side-effects
  },
}
