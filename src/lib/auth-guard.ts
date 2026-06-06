import { eq } from 'drizzle-orm'
import { auth } from './auth'
import { db } from './db'
import { tenants } from './db/schema'
import { DEFAULT_TENANT_ID, getTenantMembership } from './tenancy'

const ROLE_ORDER = { viewer: 0, member: 1, admin: 2, owner: 3 } as const

export async function requireTenantAccess(
  req: Request,
  slug: string,
  minRole: keyof typeof ROLE_ORDER = 'viewer'
) {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1)
    if (!tenant) return null
    return { tenant, role: 'owner' as const }
  }

  const session = await auth.api.getSession({ headers: req.headers as Headers })
  if (!session) return null

  const membership = await getTenantMembership(slug, session.user.id)
  if (!membership) return null

  const roleValue = ROLE_ORDER[membership.role as keyof typeof ROLE_ORDER] ?? -1
  if (roleValue < ROLE_ORDER[minRole]) return null

  return membership
}
