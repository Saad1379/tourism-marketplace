import { createHash } from "node:crypto"

export type AssistantRateLimitScope = "guest" | "guide" | "guest_context" | "guide_context"

type RateLimitBucket = {
  count: number
  resetAt: number
}

export type AssistantRateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

const ASSISTANT_RATE_LIMIT_WINDOW_MS = 60_000

const ASSISTANT_RATE_LIMITS: Record<AssistantRateLimitScope, number> = {
  guest: 12,
  guide: 24,
  guest_context: 20,
  guide_context: 40,
}

const buckets = new Map<string, RateLimitBucket>()

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}

function buildBucketKey(scope: AssistantRateLimitScope, requesterKey: string): string {
  return `${scope}:${hashKey(requesterKey)}`
}

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 3000) return
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function checkAssistantRateLimit(input: {
  scope: AssistantRateLimitScope
  requesterKey: string
  now?: number
}): AssistantRateLimitResult {
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now()
  cleanupExpiredBuckets(now)

  const limit = ASSISTANT_RATE_LIMITS[input.scope]
  const bucketKey = buildBucketKey(input.scope, input.requesterKey)
  const current = buckets.get(bucketKey)

  if (!current || current.resetAt <= now) {
    const next: RateLimitBucket = {
      count: 1,
      resetAt: now + ASSISTANT_RATE_LIMIT_WINDOW_MS,
    }
    buckets.set(bucketKey, next)
    return {
      allowed: true,
      limit,
      remaining: Math.max(limit - next.count, 0),
      resetAt: next.resetAt,
      retryAfterSeconds: 0,
    }
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds,
    }
  }

  current.count += 1
  buckets.set(bucketKey, current)
  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
    retryAfterSeconds: 0,
  }
}

