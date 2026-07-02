import { auth } from '@/lib/auth'
import {
  enforcePersistentRateLimit,
  getRequestIp,
  normalizeEmailIdentifier,
  RateLimitExceededError,
} from '@/lib/rate-limit'
import { toNextJsHandler } from 'better-auth/next-js'
import { NextRequest, NextResponse } from 'next/server'

const handlers = toNextJsHandler(auth)

export const GET = handlers.GET

export async function POST(request: NextRequest) {
  if (isSignupEmailRequest(request)) {
    const body = await readJson(request)
    const email = normalizeEmailIdentifier((body as { email?: unknown } | null)?.email)

    try {
      await enforcePersistentRateLimit({
        scope: 'auth_signup_ip',
        identifier: getRequestIp(request),
        limit: 5,
        windowMs: 15 * 60 * 1000,
      })

      await enforcePersistentRateLimit({
        scope: 'auth_signup_email',
        identifier: email ?? 'missing-or-invalid-email',
        limit: 3,
        windowMs: 60 * 60 * 1000,
      })
    } catch (err) {
      if (err instanceof RateLimitExceededError) return rateLimited(err)
      throw err
    }
  }

  return handlers.POST(request)
}

function isSignupEmailRequest(request: NextRequest) {
  return new URL(request.url).pathname.endsWith('/api/auth/sign-up/email')
}

async function readJson(request: NextRequest) {
  try {
    return await request.clone().json()
  } catch {
    return null
  }
}

function rateLimited(err: RateLimitExceededError) {
  return NextResponse.json(
    { error: 'Too many signup attempts. Try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(err.retryAfterSeconds) },
    }
  )
}
