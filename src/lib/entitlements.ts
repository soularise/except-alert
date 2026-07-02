import { isPlatformAdminEmail } from './admin'
import { changeOrganizationPlan } from './organization-lifecycle'
import type { Plan } from './plan-limits'
import type { TenantRole } from './tenant-access'

type TenantPlanInput = {
  id: string
  plan: string
  createdByUserId: string | null
}

export function effectivePlanForUser(
  tenant: TenantPlanInput,
  user: { id: string; email?: string | null } | null | undefined,
  role?: TenantRole
): Plan {
  if (
    user &&
    isPlatformAdminEmail(user.email) &&
    (tenant.createdByUserId === user.id || role === 'owner')
  ) {
    return 'growth'
  }
  return tenant.plan === 'pro' || tenant.plan === 'growth' ? tenant.plan : 'free'
}

export async function ensureEffectiveTenantPlanForUser<T extends TenantPlanInput>(
  tenant: T,
  user: { id: string; email?: string | null } | null | undefined,
  role?: TenantRole
): Promise<T & { plan: Plan }> {
  const effectivePlan = effectivePlanForUser(tenant, user, role)
  if (effectivePlan !== tenant.plan && user) {
    await changeOrganizationPlan({
      tenantId: tenant.id,
      nextPlan: effectivePlan,
      actorUserId: user.id,
      reason: 'platform_admin_effective_plan',
    })
  }
  return { ...tenant, plan: effectivePlan }
}
