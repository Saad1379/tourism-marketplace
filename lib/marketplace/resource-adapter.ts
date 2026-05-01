/**
 * Strategy interface for resource-specific booking behavior.
 *
 * Each bookable resource type (tour, car, future services) implements this
 * interface so the shared booking engine can remain generic.
 */

import type { BookingSlot, ResourceType } from "./types"

export interface ResourceAdapter {
  readonly resourceType: ResourceType

  /**
   * Fetch the schedule slot and return it in the canonical BookingSlot shape.
   * Returns null if the slot doesn't exist or belongs to a different resource type.
   */
  getSlot(scheduleId: string, supabase: any): Promise<BookingSlot | null>

  /**
   * Verify that resourceId belongs to the given seller.
   * Used to guard create/delete/update operations.
   */
  isSeller(resourceId: string, userId: string, supabase: any): Promise<boolean>

  /**
   * Return the seller/owner ID for a given resource.
   * Used to populate confirmation emails, notifications, etc.
   */
  getSellerId(resourceId: string, supabase: any): Promise<string | null>

  /**
   * Called after a booking row is inserted.
   * Adapters use this to send notifications, deduct credits, etc.
   * Must NOT throw — failures should be logged and swallowed.
   */
  onBookingCreated(params: {
    bookingId: string
    resourceId: string
    scheduleId: string
    buyerId: string
    supabase: any
  }): Promise<void>

  /**
   * Called after a booking is cancelled.
   * Adapters use this to release credits, send notifications, etc.
   * Must NOT throw.
   */
  onBookingCancelled(params: {
    bookingId: string
    resourceId: string
    supabase: any
  }): Promise<void>
}
