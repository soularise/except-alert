import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { PROVIDERS } from '@/lib/providers'
import { enforcePersistentRateLimit, RateLimitExceededError } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; providerId: string }> }
) {
  const { slug, providerId } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providerDef = PROVIDERS.find((p) => p.id === providerId)
  if (!providerDef) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  try {
    await enforcePersistentRateLimit({
      scope: 'provider_test',
      identifier: `${access.tenant.id}:${providerId}`,
      limit: 1,
      windowMs: 30_000,
    })

    const [event] = await db
      .insert(events)
      .values({
        tenantId: access.tenant.id,
        hookId: `test-${Date.now()}`,
        source: providerId,
        severity: 'info',
        title: `Test event — ${providerDef.name}`,
        description: 'Sent from Settings → Sources → Test Connection',
        category: 'test',
        tags: { test: true },
        payload: {},
        occurredAt: new Date(),
        status: 'open',
      })
      .returning()

    return NextResponse.json({ ok: true, eventId: event.id })
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: 'Rate limited. Wait 30 seconds between tests.' },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
