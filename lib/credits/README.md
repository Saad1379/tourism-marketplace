# Credit System Implementation

## Overview
The credit system allows guides to upgrade to Pro by purchasing credits. 1 credit = 1 EUR.

## How It Works

### Purchase & Upgrade Flow
1. User clicks "Upgrade to Pro" on `/dashboard/upgrade`
2. Redirected to `/checkout` with amount and plan type
3. Payment processed via Stripe wrapper (mock or real)
4. On success, `/api/upgrade` is called to:
   - Add credits to guide account (amount in cents / 100)
   - Upgrade guide to Pro plan
   - Set expiration based on plan (1 month or 12 months)

### Credit Balance & Plan Status
- Pro plan remains active as long as credit balance > 0
- Cron job `/api/cron/check-plans` runs daily to check balances
- If balance reaches 0, guide is automatically downgraded to free

### Pricing
- Monthly: €29 = 29 credits
- Yearly: €249 = 249 credits (~30% discount)

## Database Tables Used
- `guide_credits`: Stores credit balance per guide
- `credit_transactions`: Logs all credit additions/deductions
- `guide_plans`: Tracks plan type and expiration

## API Endpoints
- `POST /api/checkout`: Process payments
- `POST /api/upgrade`: Complete upgrade after payment
- `GET /api/cron/check-plans`: Check and downgrade expired plans

## Setup
Add to `.env`:
```
CRON_SECRET=your_secret_key
```

## Switching to Real Stripe
1. Install: `npm install stripe`
2. Add `STRIPE_SECRET_KEY` to `.env`
3. Set `NEXT_PUBLIC_USE_MOCK_PAYMENT=false`
4. Uncomment `RealStripeProvider` in `lib/payment/stripe-wrapper.ts`
