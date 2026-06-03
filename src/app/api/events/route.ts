import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { and, eq, lt, gte, desc, count } from 'drizzle-orm'
import { evaluateBaselines } from '@/lib/baselines'

const VALID_SEVERITIES = new Set(['critical', 'error', 'warning', 'info'])
const VALID_STATUSES = new Set(['open', 'acknowledged', 'resolved', 'dismissed'])

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const source = searchParams.get('source')
  const severity = searchParams.get('severity')
  const category = searchParams.get('category')
  const status = searchParams.get('status')
  const cursor = searchParams.get('cursor')

  const rawLimit = searchParams.get('limit')
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 50
  const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 200)

  try {
    const conditions = []

    if (source) conditions.push(eq(events.source, source))
    if (severity && VALID_SEVERITIES.has(severity)) conditions.push(eq(events.severity, severity))
    if (category) conditions.push(eq(events.category, category))
    if (status && VALID_STATUSES.has(status)) conditions.push(eq(events.status, status))
    if (cursor) {
      const cursorDate = new Date(cursor)
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(events.receivedAt, cursorDate))
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

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
      .where(where)
      .orderBy(desc(events.receivedAt))
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
      .where(gte(events.receivedAt, sixtySecondsAgo))

    const recentCount = recentResult?.value ?? 0

    const responseEvents = rows.map((row) => ({
      ...row,
      receivedAt: row.receivedAt.toISOString(),
      occurredAt: row.occurredAt.toISOString(),
    }))

    evaluateBaselines().catch((err) =>
      console.error('[events] baseline evaluation error:', err)
    )

    return NextResponse.json({ events: responseEvents, nextCursor, recentCount })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
