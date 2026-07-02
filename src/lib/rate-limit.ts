import { createHash } from 'crypto'
import { sql } from 'drizzle-orm'
import { db } from './db'

export class RateLimitExceededError extends Error {
  constructor(public retryAfterSeconds: number) {
    super('rate_limit_exceeded')
  }
}

export function getRequestIp(request: Request) {
  const trustProxyHeaders =
    process.env.EXCEPTALERT_TRUST_PROXY_HEADERS === 'true' ||
    process.env.NODE_ENV !== 'production'

  if (!trustProxyHeaders) return 'untrusted-proxy'

  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim()
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (
    cloudflareIp ||
    forwardedFor ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

export function normalizeEmailIdentifier(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null
}

export async function enforcePersistentRateLimit(input: {
  scope: string
  identifier: string
  limit: number
  windowMs: number
  now?: Date
}) {
  const now = input.now ?? new Date()
  const windowStart = new Date(Math.floor(now.getTime() / input.windowMs) * input.windowMs)
  const key = `${input.scope}:${hashIdentifier(input.identifier)}`
  const nowIso = now.toISOString()
  const windowStartIso = windowStart.toISOString()

  const rows = await db.execute<{ attempts: number }>(sql`
    INSERT INTO abuse_rate_limits (key, scope, window_start, attempts, first_seen_at, last_seen_at)
    VALUES (
      ${key},
      ${input.scope},
      ${windowStartIso}::timestamptz,
      1,
      ${nowIso}::timestamptz,
      ${nowIso}::timestamptz
    )
    ON CONFLICT (key, window_start)
    DO UPDATE SET
      attempts = abuse_rate_limits.attempts + 1,
      last_seen_at = EXCLUDED.last_seen_at
    RETURNING attempts
  `)

  const attempts = Number(rows[0]?.attempts ?? 1)
  if (attempts > input.limit) {
    const windowEndsAt = windowStart.getTime() + input.windowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((windowEndsAt - now.getTime()) / 1000))
    throw new RateLimitExceededError(retryAfterSeconds)
  }
}

function hashIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
