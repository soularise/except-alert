import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { actions, auditLog, events } from '@/lib/db/schema'
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

    const actionExecutions = await db
      .select({
        id: actions.id,
        label: actions.label,
        status: actions.status,
        triggerMode: actions.triggerMode,
        errorInfo: actions.errorInfo,
        executedAt: actions.executedAt,
        createdAt: actions.createdAt,
      })
      .from(actions)
      .where(and(eq(actions.eventId, event.id), eq(actions.tenantId, access.tenant.id)))
      .orderBy(asc(actions.createdAt))

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
      actions: actionExecutions.map((action) => ({
        ...action,
        errorInfo: sanitizeActionError(action.errorInfo),
        executedAt: action.executedAt ? action.executedAt.toISOString() : null,
        createdAt: action.createdAt ? action.createdAt.toISOString() : null,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function sanitizeActionError(errorInfo: unknown) {
  if (!errorInfo || typeof errorInfo !== 'object') return null
  const value = errorInfo as Record<string, unknown>
  if (typeof value.statusCode === 'number') return { statusCode: value.statusCode }
  return { message: 'Action delivery failed.' }
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'member')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [event] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, id), eq(events.tenantId, access.tenant.id)))
      .limit(1)

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    await db.delete(actions).where(eq(actions.eventId, id))
    await db.delete(events).where(and(eq(events.id, id), eq(events.tenantId, access.tenant.id)))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
