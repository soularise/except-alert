import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser, tenantInvitations, tenantMemberships } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const members = await db
      .select({
        id: tenantMemberships.id,
        userId: tenantMemberships.userId,
        role: tenantMemberships.role,
        joinedAt: tenantMemberships.joinedAt,
        name: authUser.name,
        email: authUser.email,
      })
      .from(tenantMemberships)
      .innerJoin(authUser, eq(tenantMemberships.userId, authUser.id))
      .where(eq(tenantMemberships.tenantId, access.tenant.id))
      .orderBy(tenantMemberships.joinedAt)

    const invitations = await db
      .select({
        id: tenantInvitations.id,
        email: tenantInvitations.email,
        role: tenantInvitations.role,
        token: tenantInvitations.token,
        expiresAt: tenantInvitations.expiresAt,
        acceptedAt: tenantInvitations.acceptedAt,
        createdAt: tenantInvitations.createdAt,
      })
      .from(tenantInvitations)
      .where(eq(tenantInvitations.tenantId, access.tenant.id))
      .orderBy(desc(tenantInvitations.createdAt))

    return NextResponse.json({
      members,
      invitations: invitations.filter((invitation) => !invitation.acceptedAt),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
