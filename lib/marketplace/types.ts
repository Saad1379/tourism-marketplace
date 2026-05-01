/**
 * Shared marketplace types — resource-agnostic booking primitives.
 *
 * These types intentionally avoid "tour" or "car" terminology so they can
 * be reused for any future service type (events, rentals, experiences, etc.).
 */

export type ResourceType = "tour" | "car"

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "upcoming"
  | "completed"
  | "cancelled"
  | "no_show"

export type MarketplaceRole = "buyer" | "seller" | "admin"

/** Roles accepted in the DB (includes legacy names for backward compat) */
export type AnyRole = MarketplaceRole | "tourist" | "guide"

/**
 * A time slot attached to a bookable resource.
 * Mirrors both tour_schedules and car_schedules.
 */
export interface BookingSlot {
  id: string
  resource_id: string
  resource_type: ResourceType
  start_time: string
  /** Only relevant for multi-day resources like cars */
  end_time?: string | null
  capacity: number
  booked_count: number
}

/** Input for creating a new booking via the shared engine */
export interface CreateBookingInput {
  resource_type: ResourceType
  resource_id: string
  /** The specific schedule/slot UUID */
  schedule_id: string
  buyer_id: string
  adults: number
  children: number
}

/** Result of a capacity calculation */
export interface CapacityResult {
  remaining: number
  booked: number
  capacity: number
  available: boolean
}

/** A booking row as returned by the shared engine */
export interface BookingRecord {
  id: string
  resource_type: ResourceType
  resource_id: string
  resource_schedule_id: string
  /** Legacy column — kept for backward compat with tour bookings */
  schedule_id: string | null
  buyer_id: string
  status: BookingStatus
  adults: number
  children: number
  total_guests: number
  credits_charged: number
  payment_status: string
  created_at: string
}
