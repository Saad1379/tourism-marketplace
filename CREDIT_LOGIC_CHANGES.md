# Credit Deduction Logic - Implementation Summary

## Overview
Fixed the credit deduction flow to properly handle holds, deductions, and refunds based on tour attendance and cancellation timing.

## New Credit Flow

### 1. When a Tour is Booked (POST /api/bookings)
- **Action**: Credits are put on hold (via database trigger)
- **Implementation**: 
  - Booking is created with status="pending"
  - Database trigger `deduct_credits_on_booking` automatically:
    - Calculates 3 credits per adult
    - Checks if guide has sufficient balance
    - Deducts from guide's balance (held state)
    - Creates "spend" transaction
    - Updates `bookings.credits_charged`
- **Database Changes**:
  - `bookings.credits_charged` = 3 × adults
  - `credit_transactions` entry with type="spend"
  - `guide_credits.balance` reduced

### 2. When Guide Marks Attendance (POST /api/attendance)
- **Action**: Credits are finalized (via database function)
- **Implementation**:
  - Attendance record created
  - Booking status updated to "completed"
  - Calls `finalize_credits_on_attendance` function:
    - Creates "attendance_fee" transaction (amount=0, tracking only)
    - Records that held credits are now finalized
- **Database Changes**:
  - `attendance` record with `confirmed_by_guide=true`
  - `bookings.status` = "completed"
  - `credit_transactions` entry with type="attendance_fee"

### 3. When Booking is Cancelled (PATCH /api/bookings)
- **Action**: Refund based on timing (via database trigger)
- **Implementation**:
  - Booking status updated to "cancelled"
  - Database trigger `refund_credits_on_cancellation` automatically:
    - Checks time until tour (24-hour rule)
    - If >24h: Creates "refund" transaction and returns credits
    - If <24h: No refund
- **Database Changes**:
  - `bookings.status` = "cancelled"
  - If refund: `credit_transactions` entry with type="refund"
  - If refund: `guide_credits.balance` increased

## New API Endpoints

### /api/credits/hold (POST)
- Purpose: Manually put credits on hold for a booking
- Used by: Booking system
- Parameters: `booking_id`, `credits_amount`

### /api/credits/refund (POST)
- Purpose: Process credit refunds for cancelled bookings
- Used by: Cancellation system
- Parameters: `booking_id`
- Logic: Checks 24-hour rule automatically

## Credit Transaction Types

1. **spend**: Credits put on hold when booking is made
2. **attendance_fee**: Record of attendance confirmation (tracking only)
3. **refund**: Credits returned when cancelled >24h before tour
4. **purchase**: Credits purchased by guide
5. **bonus**: Promotional credits
6. **boost**: Credits spent on tour boosts

## Database Schema Usage

### Tables Modified:
- `bookings`: Uses `credits_charged` field
- `credit_transactions`: New transaction types added
- `guide_credits`: Balance updated at hold and refund
- `attendance`: Triggers credit finalization

### Key Fields:
- `bookings.credits_charged`: Amount held/charged
- `credit_transactions.type`: Transaction category
- `credit_transactions.reference_id`: Links to booking
- `attendance.confirmed_by_guide`: Triggers finalization

## Testing Scenarios

1. **Normal Flow**: Book → Attend → Credits stay deducted ✓
2. **Early Cancel**: Book → Cancel (>24h) → Credits refunded ✓
3. **Late Cancel**: Book → Cancel (<24h) → No refund ✓
4. **Insufficient Credits**: Book attempt → Rejected ✓

## Notes
- Credits are deducted immediately on booking via database trigger
- The "hold" is actually a deduction - credits are removed from balance
- Attendance confirmation records finalization via database function
- Refund logic is automatic via database trigger based on 24-hour rule
- **3 credits = 1 adult guest**
- Tourists can book even if guide has insufficient credits (non-blocking)
- All credit logic handled by database triggers/functions for consistency
