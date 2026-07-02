import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { cache } from 'react'
import { db } from './db'
import { auth } from './auth'
import { authUser, tenantInvitations, tenantMemberships, tenants } from './db/schema'
import { createIngressKey } from './organization-lifecycle'

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

/** @deprecated Use explicit organization lifecycle operations instead. */
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
    .values({
      name: `${userName}'s Org`,
      slug,
      plan: 'free',
      createdByUserId: userId,
      ingressKey: createIngressKey(),
    })
    .returning()

  await db.insert(tenantMemberships).values({
    userId,
    tenantId: tenant.id,
    role: 'owner',
  })

  return tenant
}

export const getServerSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

export const getTenantMembership = cache(async (slug: string, userId: string) => {
  const [row] = await db
    .select({ tenant: tenants, role: tenantMemberships.role })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(and(eq(tenants.slug, slug), eq(tenantMemberships.userId, userId)))
    .limit(1)
  return row ?? null
})

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

export async function getTenantsForUser(userId: string) {
  return db
    .select({
      name: tenants.name,
      slug: tenants.slug,
      role: tenantMemberships.role,
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(eq(tenantMemberships.userId, userId))
    .orderBy(tenantMemberships.joinedAt)
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
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${token}), 2)`)

    const [invitation] = await tx
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

    const [user] = await tx
      .select({ emailVerified: authUser.emailVerified })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1)

    if (!user?.emailVerified) {
      return { error: 'Verify your email address before accepting this invitation' as const }
    }

    await tx
      .insert(tenantMemberships)
      .values({
        userId,
        tenantId:  invitation.tenantId,
        role:      invitation.role,
        invitedBy: invitation.invitedBy,
      })
      .onConflictDoNothing()

    await tx
      .update(tenantInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(tenantInvitations.token, token))

    const [tenant] = await tx
      .select()
      .from(tenants)
      .where(eq(tenants.id, invitation.tenantId))
      .limit(1)

    return { tenant }
  })
}

export async function getServerTenantId(slug: string): Promise<string | null> {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    return DEFAULT_TENANT_ID
  }
  const session = await getServerSession()
  if (!session) return null
  const membership = await getTenantMembership(slug, session.user.id)
  return membership?.tenant.id ?? null
}
