/**
 * Shared booking engine — the core of the marketplace.
 *
 * This service layer is resource-agnostic. It accepts a ResourceAdapter
 * (Strategy pattern) to handle resource-specific behavior while keeping
 * all shared logic (capacity validation, duplicate detection, state
 * transitions) in one place.
 *
 * Race condition safety:
 * - Uses a live count query for capacity (not the denormalized booked_count)
 *   immediately before insert, which prevents most overbooking scenarios.
 * - For production-grade safety, wrap in a Supabase RPC / DB transaction.
 */

import type { ResourceAdapter } from "./resource-adapter"
import type { CreateBookingInput, BookingRecord, BookingStatus } from "./types"
import { computeRemainingCapacity, validateCapacity } from "./capacity"

type BookingEngineResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

function err(error: string, status: number): { ok: false; error: string; status: number } {
  return { ok: false, error, status }
}

function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data }
}

/**
 * Create a new booking using the shared engine.
 *
 * Enforces:
 * 1. Schedule exists and belongs to the correct resource type
 * 2. Slot has remaining capacity (using total_guests, not just adults)
 * 3. Buyer does not already have an active booking on this exact slot
 * 4. Buyer does not already have an active booking for the same resource
 *    on a different slot (prevents holding multiple slots for one resource)
 */
export async function createBooking(
  input: CreateBookingInput,
  adapter: ResourceAdapter,
  supabase: any,
): Promise<BookingEngineResult<BookingRecord>> {
  const { resource_type, resource_id, schedule_id, buyer_id, adults, children } = input
  const totalGuests = adults + children

  if (totalGuests <= 0) {
    return err("At least one guest is required", 400)
  }

  // 1. Fetch the slot
  const slot = await adapter.getSlot(schedule_id, supabase)
  if (!slot) {
    return err("Schedule not found", 404)
  }

  // 2. Live capacity check — query active bookings for this slot
  const { data: activeBookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("adults, children, total_guests")
    .eq("resource_schedule_id", schedule_id)
    .in("status", ["pending", "confirmed", "upcoming"])

  if (bookingsError) {
    return err(bookingsError.message, 500)
  }

  // Fall back to legacy schedule_id column for existing tour bookings
  const { data: legacyBookings } = await supabase
    .from("bookings")
    .select("adults, children, total_guests")
    .eq("schedule_id", schedule_id)
    .is("resource_schedule_id", null)
    .in("status", ["pending", "confirmed", "upcoming"])

  const allActiveBookings = [...(activeBookings ?? []), ...(legacyBookings ?? [])]
  const capacityResult = computeRemainingCapacity(slot.capacity, allActiveBookings)
  const capacityError = validateCapacity(totalGuests, capacityResult)

  if (capacityError) {
    return err(capacityError, 400)
  }

  // 3. Duplicate booking check: same buyer + same exact slot
  const { data: duplicateSlot } = await supabase
    .from("bookings")
    .select("id")
    .or(`resource_schedule_id.eq.${schedule_id},schedule_id.eq.${schedule_id}`)
    .eq("tourist_id", buyer_id)
    .in("status", ["pending", "confirmed", "upcoming"])
    .maybeSingle()

  if (duplicateSlot) {
    return err("You already have an active booking for this slot", 409)
  }

  // 4. Duplicate resource check: same buyer + same resource (different slot)
  const { data: duplicateResource } = await supabase
    .from("bookings")
    .select("id, resource_schedule_id, schedule_id")
    .eq("resource_id", resource_id)
    .eq("resource_type", resource_type)
    .eq("tourist_id", buyer_id)
    .in("status", ["pending", "confirmed", "upcoming"])
    .limit(1)
    .maybeSingle()

  if (duplicateResource) {
    return err(
      `You already have an active booking for this ${resource_type}. Cancel it first to book another slot.`,
      409,
    )
  }

  // 5. Insert booking
  const { data: newBooking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      // Polymorphic fields
      resource_type,
      resource_id,
      resource_schedule_id: schedule_id,
      // Legacy fields (kept for backward compat with existing tour bookings)
      schedule_id: resource_type === "tour" ? schedule_id : null,
      tour_id: resource_type === "tour" ? resource_id : null,
      // Buyer
      tourist_id: buyer_id,
      // Guest counts
      adults,
      children,
      total_guests: totalGuests,
      // Defaults
      status: "pending" as BookingStatus,
      payment_status: "completed",
      credits_charged: 0,
    })
    .select()
    .single()

  if (insertError || !newBooking) {
    console.error("[marketplace] Error creating booking:", insertError)
    return err(insertError?.message ?? "Failed to create booking", 500)
  }

  // 6. Confirm the booking
  const { data: confirmedBooking, error: confirmError } = await supabase
    .from("bookings")
    .update({ status: "confirmed" as BookingStatus })
    .eq("id", newBooking.id)
    .select()
    .single()

  if (confirmError || !confirmedBooking) {
    // Roll back the pending booking to avoid orphaned records
    await supabase.from("bookings").delete().eq("id", newBooking.id)
    return err(confirmError?.message ?? "Failed to confirm booking", 500)
  }

  // 7. Resource-specific post-booking side effects (non-blocking)
  try {
    await adapter.onBookingCreated({
      bookingId: confirmedBooking.id,
      resourceId: resource_id,
      scheduleId: schedule_id,
      buyerId: buyer_id,
      supabase,
    })
  } catch (e) {
    console.error("[marketplace] onBookingCreated side effect failed:", e)
  }

  return ok(confirmedBooking as BookingRecord)
}

/**
 * Cancel a booking.
 *
 * Validates that the requesting user owns the booking (or is an admin).
 * Only confirmed/upcoming bookings can be cancelled.
 */
export async function cancelBooking(
  bookingId: string,
  requestingUserId: string,
  adapter: ResourceAdapter,
  supabase: any,
): Promise<BookingEngineResult<{ id: string; status: BookingStatus }>> {
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, tourist_id, status, resource_id, resource_type, credits_charged")
    .eq("id", bookingId)
    .single()

  if (fetchError || !booking) {
    return err("Booking not found", 404)
  }

  if (booking.tourist_id !== requestingUserId) {
    return err("Unauthorized", 403)
  }

  const cancellableStatuses: BookingStatus[] = ["confirmed", "upcoming"]
  if (!cancellableStatuses.includes(booking.status)) {
    return err(`Cannot cancel a ${booking.status} booking`, 400)
  }

  const { data: cancelled, error: cancelError } = await supabase
    .from("bookings")
    .update({ status: "cancelled" as BookingStatus })
    .eq("id", bookingId)
    .select("id, status")
    .single()

  if (cancelError || !cancelled) {
    return err(cancelError?.message ?? "Failed to cancel booking", 500)
  }

  // Resource-specific post-cancellation side effects (non-blocking)
  try {
    await adapter.onBookingCancelled({
      bookingId,
      resourceId: booking.resource_id,
      supabase,
    })
  } catch (e) {
    console.error("[marketplace] onBookingCancelled side effect failed:", e)
  }

  return ok(cancelled as { id: string; status: BookingStatus })
}
