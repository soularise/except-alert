import { eq } from 'drizzle-orm'
import { isPlatformAdminEmail } from './admin'
import { db } from './db'
import { tenants } from './db/schema'
import type { Plan } from './plan-limits'

type TenantPlanInput = {
  id: string
  plan: string
  createdByUserId: string | null
}

export function effectivePlanForUser(
  tenant: TenantPlanInput,
  user: { id: string; email?: string | null } | null | undefined
): Plan {
  if (user && tenant.createdByUserId === user.id && isPlatformAdminEmail(user.email)) {
    return 'growth'
  }
  return tenant.plan === 'pro' || tenant.plan === 'growth' ? tenant.plan : 'free'
}

export async function ensureEffectiveTenantPlanForUser<T extends TenantPlanInput>(
  tenant: T,
  user: { id: string; email?: string | null } | null | undefined
): Promise<T & { plan: Plan }> {
  const effectivePlan = effectivePlanForUser(tenant, user)
  if (effectivePlan !== tenant.plan) {
    await db
      .update(tenants)
      .set({ plan: effectivePlan })
      .where(eq(tenants.id, tenant.id))
  }
  return { ...tenant, plan: effectivePlan }
}
