import { and, eq } from 'drizzle-orm'
import { db } from './db'
import { tenantInvitations, tenantMemberships, tenants } from './db/schema'

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function createTenantForUser(userId: string, userName: string) {
  let slug = userName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'org'

  const existing = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`
  }

  const [tenant] = await db
    .insert(tenants)
    .values({ name: `${userName}'s Org`, slug })
    .returning()

  await db.insert(tenantMemberships).values({
    userId,
    tenantId: tenant.id,
    role: 'owner',
  })

  return tenant
}

export async function getTenantMembership(slug: string, userId: string) {
  const [row] = await db
    .select({ tenant: tenants, role: tenantMemberships.role })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(and(eq(tenants.slug, slug), eq(tenantMemberships.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function getFirstTenantForUser(userId: string) {
  const [row] = await db
    .select({ slug: tenants.slug })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(eq(tenantMemberships.userId, userId))
    .orderBy(tenantMemberships.joinedAt)
    .limit(1)
  return row ?? null
}

export async function createInvitation(
  tenantId: string,
  invitedBy: string,
  email: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [invitation] = await db
    .insert(tenantInvitations)
    .values({ tenantId, invitedBy, email, role, token, expiresAt })
    .returning()

  return invitation
}

export async function acceptInvitation(token: string, userId: string, userEmail: string) {
  const [invitation] = await db
    .select()
    .from(tenantInvitations)
    .where(eq(tenantInvitations.token, token))
    .limit(1)

  if (!invitation) return { error: 'Invitation not found' as const }
  if (invitation.acceptedAt) return { error: 'Invitation already used' as const }
  if (new Date() > invitation.expiresAt) return { error: 'Invitation expired' as const }
  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { error: 'Invitation was sent to a different email address' as const }
  }

  await db
    .insert(tenantMemberships)
    .values({
      userId,
      tenantId:  invitation.tenantId,
      role:      invitation.role,
      invitedBy: invitation.invitedBy,
    })
    .onConflictDoNothing()

  await db
    .update(tenantInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(tenantInvitations.token, token))

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, invitation.tenantId))
    .limit(1)

  return { tenant }
}
