import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin'
import { db } from '@/lib/db'
import { upgradeRequests } from '@/lib/db/schema'
import { changeOrganizationPlan } from '@/lib/organization-lifecycle'
import type { Plan } from '@/lib/plan-limits'

const statusSchema = z.object({
  status: z.enum(['payment_sent', 'paid', 'approved', 'declined']),
  adminNote: z.string().trim().max(1000).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getAdminSession(request.headers)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid upgrade request status' }, { status: 400 })
  }

  try {
    const [requestRow] = await db
      .select()
      .from(upgradeRequests)
      .where(eq(upgradeRequests.id, id))
      .limit(1)

    if (!requestRow) return NextResponse.json({ error: 'Upgrade request not found' }, { status: 404 })
    if (!['open', 'payment_sent', 'paid'].includes(requestRow.status)) {
      return NextResponse.json({ error: 'Upgrade request is already resolved' }, { status: 409 })
    }

    if (parsed.data.status === 'approved') {
      await changeOrganizationPlan({
        tenantId: requestRow.tenantId,
        nextPlan: requestRow.requestedPlan as Plan,
        actorUserId: session.user.id,
        reason: 'upgrade_request_approved',
      })
    }

    const resolved = parsed.data.status === 'approved' || parsed.data.status === 'declined'
    const [updated] = await db
      .update(upgradeRequests)
      .set({
        status: parsed.data.status,
        adminNote: parsed.data.adminNote ?? requestRow.adminNote,
        resolvedByUserId: resolved ? session.user.id : requestRow.resolvedByUserId,
        resolvedAt: resolved ? new Date() : requestRow.resolvedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(upgradeRequests.id, id),
          inArray(upgradeRequests.status, ['open', 'payment_sent', 'paid'])
        )
      )
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Upgrade request is already resolved' }, { status: 409 })
    }

    return NextResponse.json({ request: updated })
  } catch (err) {
    console.error('[admin upgrade request] failed to update request:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
