import { NextRequest, NextResponse } from 'next/server'
import { and, count, desc, eq, gte, isNull, lt, not, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { evaluateBaselines } from '@/lib/baselines'
import { requireTenantAccess } from '@/lib/auth-guard'

const VALID_SEVERITIES = new Set(['critical', 'error', 'warning', 'info'])
const VALID_STATUSES = new Set(['open', 'acknowledged', 'resolved', 'dismissed'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const source = searchParams.get('source')
  const severity = searchParams.get('severity')
  const category = searchParams.get('category')
  const status = searchParams.get('status')
  const cursor = searchParams.get('cursor')
  const rawOffset = searchParams.get('offset')

  const rawLimit = searchParams.get('limit')
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 50
  const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 200)
  const parsedOffset = rawOffset ? parseInt(rawOffset, 10) : 0
  const offset = isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset

  try {
    const conditions = [eq(events.tenantId, access.tenant.id)]
    if (source) conditions.push(eq(events.source, source))
    if (severity && VALID_SEVERITIES.has(severity)) conditions.push(eq(events.severity, severity))
    if (category) conditions.push(eq(events.category, category))
    if (status && VALID_STATUSES.has(status)) {
      conditions.push(eq(events.status, status))
    } else {
      const activeStatus = or(isNull(events.status), not(eq(events.status, 'dismissed')))
      if (activeStatus) conditions.push(activeStatus)
    }
    if (cursor) {
      const cursorDate = new Date(cursor)
      if (!isNaN(cursorDate.getTime())) conditions.push(lt(events.receivedAt, cursorDate))
    }

    const whereClause = and(...conditions)
    const [totalResult] = await db
      .select({ value: count() })
      .from(events)
      .where(whereClause)

    const rows = await db
      .select({
        id: events.id,
        hookId: events.hookId,
        source: events.source,
        severity: events.severity,
        title: events.title,
        description: events.description,
        category: events.category,
        tags: events.tags,
        receivedAt: events.receivedAt,
        occurredAt: events.occurredAt,
        status: events.status,
      })
      .from(events)
      .where(whereClause)
      .orderBy(desc(events.receivedAt))
      .offset(cursor ? 0 : offset)
      .limit(limit + 1)

    let nextCursor: string | null = null
    if (rows.length > limit) {
      const last = rows.pop()!
      nextCursor = last.receivedAt.toISOString()
    }

    const sixtySecondsAgo = new Date(Date.now() - 60_000)
    const [recentResult] = await db
      .select({ value: count() })
      .from(events)
      .where(and(eq(events.tenantId, access.tenant.id), gte(events.receivedAt, sixtySecondsAgo)))

    evaluateBaselines(access.tenant.id).catch((err) =>
      console.error('[events] baseline evaluation error:', err)
    )

    return NextResponse.json({
      events: rows.map((row) => ({
        ...row,
        receivedAt: row.receivedAt.toISOString(),
        occurredAt: row.occurredAt.toISOString(),
      })),
      nextCursor,
      totalCount: totalResult?.value ?? 0,
      recentCount: recentResult?.value ?? 0,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
