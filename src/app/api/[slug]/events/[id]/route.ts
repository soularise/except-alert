import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog, events } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'

const VALID_STATUSES = new Set(['open', 'acknowledged', 'resolved', 'dismissed'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.tenantId, access.tenant.id)))
      .limit(1)

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const auditEntries = await db
      .select({
        id: auditLog.id,
        hookId: auditLog.hookId,
        providerId: auditLog.providerId,
        status: auditLog.status,
        errorInfo: auditLog.errorInfo,
        receivedAt: auditLog.receivedAt,
        processedAt: auditLog.processedAt,
        deliveredAt: auditLog.deliveredAt,
        schemaName: auditLog.schemaName,
        mappingName: auditLog.mappingName,
      })
      .from(auditLog)
      .where(eq(auditLog.hookId, event.hookId))
      .orderBy(asc(auditLog.receivedAt))

    return NextResponse.json({
      event: {
        ...event,
        occurredAt: event.occurredAt.toISOString(),
        receivedAt: event.receivedAt.toISOString(),
      },
      auditLog: auditEntries.map((entry) => ({
        ...entry,
        receivedAt: entry.receivedAt.toISOString(),
        processedAt: entry.processedAt ? entry.processedAt.toISOString() : null,
        deliveredAt: entry.deliveredAt ? entry.deliveredAt.toISOString() : null,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'member')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status } = body as { status?: unknown }
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Must be one of: open, acknowledged, resolved, dismissed' },
      { status: 400 }
    )
  }

  try {
    const [updated] = await db
      .update(events)
      .set({ status })
      .where(and(eq(events.id, id), eq(events.tenantId, access.tenant.id)))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    return NextResponse.json({
      event: {
        ...updated,
        occurredAt: updated.occurredAt.toISOString(),
        receivedAt: updated.receivedAt.toISOString(),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
