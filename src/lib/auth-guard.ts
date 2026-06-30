import { eq } from 'drizzle-orm'
import { auth } from './auth'
import { db } from './db'
import { tenants } from './db/schema'
import { ensureEffectiveTenantPlanForUser } from './entitlements'
import { getTenantMembership } from './tenancy'
import { hasTenantRole, type TenantRole } from './tenant-access'

export async function requireTenantAccess(
  req: Request,
  slug: string,
  minRole: TenantRole = 'viewer'
) {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    if (slug !== 'default') return null
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

  if (!hasTenantRole(membership.role, minRole)) return null

  const tenant = await ensureEffectiveTenantPlanForUser(membership.tenant, session.user)
  return { ...membership, tenant, user: session.user }
}
