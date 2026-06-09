import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { PROVIDERS } from '@/lib/providers'

// Module-level rate limit store: "tenantId:providerId" -> last test timestamp (ms)
const lastTestAt = new Map<string, number>()
const RATE_LIMIT_MS = 30_000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; providerId: string }> }
) {
  const { slug, providerId } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providerDef = PROVIDERS.find((p) => p.id === providerId)
  if (!providerDef) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  const rateLimitKey = `${access.tenant.id}:${providerId}`
  const last = lastTestAt.get(rateLimitKey) ?? 0
  if (Date.now() - last < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: 'Rate limited — wait 30 seconds between tests' },
      { status: 429 }
    )
  }
  lastTestAt.set(rateLimitKey, Date.now())

  try {
    const [event] = await db
      .insert(events)
      .values({
        tenantId: access.tenant.id,
        hookId: `test-${Date.now()}`,
        source: providerId,
        severity: 'info',
        title: `Test event — ${providerDef.name}`,
        description: 'Sent from Provider Settings → Test Connection',
        category: 'test',
        tags: { test: true },
        payload: {},
        occurredAt: new Date(),
        status: 'open',
      })
      .returning()

    return NextResponse.json({ ok: true, eventId: event.id })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
