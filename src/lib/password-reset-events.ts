import { eq } from 'drizzle-orm'
import { db } from './db'
import { events, tenantMemberships, tenants } from './db/schema'

type ResetEventUser = {
  id: string
  email: string
  name?: string
}

type ResetEventTenant = {
  id: string
  slug: string
}

interface CreatePasswordResetEventOptions {
  user: ResetEventUser
  resetUrl: string
  request?: Request
}

async function getTargetTenants(userId: string): Promise<ResetEventTenant[]> {
  const tenantId = process.env.EXCEPTALERT_PASSWORD_RESET_EVENT_TENANT_ID
  if (tenantId) {
    return db
      .select({ id: tenants.id, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
  }

  const tenantSlug = process.env.EXCEPTALERT_PASSWORD_RESET_EVENT_TENANT_SLUG
  if (tenantSlug) {
    return db
      .select({ id: tenants.id, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1)
  }

  return db
    .select({ id: tenants.id, slug: tenants.slug })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(eq(tenantMemberships.userId, userId))
}

function getRequestMetadata(request?: Request) {
  if (!request) return {}

  const forwardedFor = request.headers.get('x-forwarded-for')
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip')
  const userAgent = request.headers.get('user-agent')

  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  }
}

export async function createPasswordResetRequestEvents({
  user,
  resetUrl,
  request,
}: CreatePasswordResetEventOptions) {
  const targetTenants = await getTargetTenants(user.id)
  if (targetTenants.length === 0) {
    console.warn(`[password reset] no tenant found for reset request from ${user.email}`)
    return
  }

  const now = new Date()
  const requestMetadata = getRequestMetadata(request)

  await db.insert(events).values(
    targetTenants.map((tenant) => ({
      tenantId: tenant.id,
      hookId: `auth-password-reset-${user.id}-${tenant.id}-${now.getTime()}`,
      source: 'auth',
      severity: 'warning',
      title: `Password reset requested for ${user.email}`,
      description: 'Verify the requester out of band before sharing the reset link.',
      category: 'security.password_reset_requested',
      tags: {
        userId: user.id,
        email: user.email,
        tenantSlug: tenant.slug,
      },
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name ?? null,
        resetUrl,
        requestedAt: now.toISOString(),
        delivery: 'operator-mediated',
        ...requestMetadata,
      },
      occurredAt: now,
      receivedAt: now,
      status: 'open',
    }))
  )
}
