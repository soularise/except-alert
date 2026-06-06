import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { baselines } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'

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

  const { category, threshold, window_minutes } = body as {
    category?: unknown
    threshold?: unknown
    window_minutes?: unknown
  }

  const updates: Partial<typeof baselines.$inferInsert> = {}
  if (typeof category === 'string') updates.category = category.trim()
  if (typeof threshold === 'number' && threshold >= 1) updates.threshold = threshold
  if (typeof window_minutes === 'number' && window_minutes >= 1) {
    updates.windowMinutes = window_minutes
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const [updated] = await db
      .update(baselines)
      .set(updates)
      .where(and(eq(baselines.id, id), eq(baselines.tenantId, access.tenant.id)))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Baseline not found' }, { status: 404 })
    return NextResponse.json({ baseline: updated })
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
    const [deleted] = await db
      .delete(baselines)
      .where(and(eq(baselines.id, id), eq(baselines.tenantId, access.tenant.id)))
      .returning()

    if (!deleted) return NextResponse.json({ error: 'Baseline not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
