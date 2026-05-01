/**
 * Centralized capacity math — single source of truth.
 *
 * IMPORTANT BUG FIX: The old availability route counted only `adults` when
 * computing how many seats are taken, ignoring children. This function always
 * uses `total_guests` (or falls back to adults + children) to prevent
 * overbooking when children are included in a booking.
 */

import type { CapacityResult } from "./types"

type BookingForCapacity = {
  adults?: number | null
  children?: number | null
  total_guests?: number | null
}

/**
 * Compute remaining capacity for a single schedule slot.
 *
 * @param capacity - The slot's total capacity
 * @param bookings - Active bookings on this slot (pending/confirmed/upcoming)
 * @returns CapacityResult with remaining seats and availability flag
 */
export function computeRemainingCapacity(
  capacity: number,
  bookings: BookingForCapacity[],
): CapacityResult {
  const safeCapacity = Math.max(Number(capacity) || 0, 0)

  const booked = bookings.reduce((sum, b) => {
    // Prefer total_guests — it is the authoritative field stored at booking creation.
    const guests = Number(b.total_guests ?? 0)
    if (guests > 0) return sum + guests

    // Fallback: sum adults + children for legacy rows that may have 0 total_guests.
    const adults = Number(b.adults ?? 0)
    const children = Number(b.children ?? 0)
    return sum + adults + children
  }, 0)

  const remaining = Math.max(safeCapacity - booked, 0)

  return {
    remaining,
    booked,
    capacity: safeCapacity,
    available: remaining > 0,
  }
}

/**
 * Validate that a requested group fits within remaining capacity.
 * Returns an error message string, or null if the booking is valid.
 */
export function validateCapacity(
  requestedGuests: number,
  result: CapacityResult,
): string | null {
  if (requestedGuests <= 0) {
    return "At least one guest is required"
  }
  if (requestedGuests > result.remaining) {
    return result.remaining === 0
      ? "This slot is fully booked"
      : `Only ${result.remaining} spot${result.remaining === 1 ? "" : "s"} available`
  }
  return null
}
