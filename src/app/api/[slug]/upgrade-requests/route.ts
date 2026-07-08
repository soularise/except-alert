import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireTenantAccess } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { upgradeRequests } from '@/lib/db/schema'
import { notifyPlatformUpgradeRequest } from '@/lib/platform-notifications'

const upgradeRequestSchema = z.object({
  requestedPlan: z.enum(['pro', 'growth']).default('pro'),
  source: z.string().trim().min(1).max(80).default('manual'),
  reason: z.string().trim().max(1000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access || !('user' in access)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = upgradeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid upgrade request' }, { status: 400 })
  }

  if (access.tenant.plan === parsed.data.requestedPlan || access.tenant.plan === 'growth') {
    return NextResponse.json(
      { error: 'This organization is already on that plan or higher.' },
      { status: 409 }
    )
  }

  try {
    const [created] = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${access.tenant.id}), 5)`)

      const [existing] = await tx
        .select({ id: upgradeRequests.id, status: upgradeRequests.status })
        .from(upgradeRequests)
        .where(
          and(
            eq(upgradeRequests.tenantId, access.tenant.id),
            inArray(upgradeRequests.status, ['open', 'payment_sent', 'paid'])
          )
        )
        .limit(1)

      if (existing) throw new UpgradeRequestRouteError('active_request')

      return tx
        .insert(upgradeRequests)
        .values({
          tenantId: access.tenant.id,
          requesterUserId: access.user.id,
          currentPlan: access.tenant.plan,
          requestedPlan: parsed.data.requestedPlan,
          source: parsed.data.source,
          requestReason: parsed.data.reason ?? null,
        })
        .returning()
    })

    notifyPlatformUpgradeRequest({
      organizationName: access.tenant.name,
      organizationSlug: access.tenant.slug,
      requesterName: access.user.name ?? access.user.email,
      requesterEmail: access.user.email,
      currentPlan: access.tenant.plan,
      requestedPlan: parsed.data.requestedPlan,
      source: parsed.data.source,
      reason: parsed.data.reason ?? null,
    }).catch((err) => {
      console.error('[upgrade request] platform notification failed:', err)
    })

    return NextResponse.json({ request: created }, { status: 201 })
  } catch (err) {
    if (err instanceof UpgradeRequestRouteError && err.code === 'active_request') {
      return NextResponse.json(
        { error: 'An upgrade request is already open for this organization.' },
        { status: 409 }
      )
    }

    if (err instanceof Error && err.message.includes('upgrade_requests_one_active_per_tenant')) {
      return NextResponse.json(
        { error: 'An upgrade request is already open for this organization.' },
        { status: 409 }
      )
    }

    console.error('[upgrade request] failed to create request:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

class UpgradeRequestRouteError extends Error {
  constructor(public code: 'active_request') {
    super(code)
  }
}
