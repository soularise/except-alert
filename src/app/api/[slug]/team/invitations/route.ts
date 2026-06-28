import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenantInvitations, tenantMemberships } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { createInvitation } from '@/lib/tenancy'
import { canInviteMember, limitsFor } from '@/lib/plan-limits'

const VALID_INVITE_ROLES = new Set(['admin', 'member', 'viewer'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!('user' in access)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, role } = body as { email?: unknown; role?: unknown }
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (typeof role !== 'string' || !VALID_INVITE_ROLES.has(role)) {
    return NextResponse.json({ error: 'Valid role is required' }, { status: 400 })
  }

  try {
    const [memberResult] = await db
      .select({ value: count() })
      .from(tenantMemberships)
      .where(eq(tenantMemberships.tenantId, access.tenant.id))

    const [pendingResult] = await db
      .select({ value: count() })
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, access.tenant.id),
          isNull(tenantInvitations.acceptedAt),
          gt(tenantInvitations.expiresAt, new Date())
        )
      )

    const occupiedSeats = (memberResult?.value ?? 0) + (pendingResult?.value ?? 0)
    if (!canInviteMember(access.tenant.plan, occupiedSeats)) {
      const limit = limitsFor(access.tenant.plan).members
      return NextResponse.json(
        { error: `Your current plan allows ${limit} organization member${limit === 1 ? '' : 's'}.` },
        { status: 403 }
      )
    }

    const invitation = await createInvitation(
      access.tenant.id,
      access.user.id,
      email.trim().toLowerCase(),
      role as 'admin' | 'member' | 'viewer'
    )
    const url = new URL(request.url)
    const inviteUrl = `${url.origin}/invite/${invitation.token}`
    return NextResponse.json({ invitation, inviteUrl }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
