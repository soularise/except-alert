export type Plan = 'free' | 'pro' | 'growth'

export type DeliveryChannel = 'dashboard' | 'telegram' | 'slack'

export type PlanLimits = {
  members: number | null
  providers: number | null
  externalEventsPerMonth: number | null
  controllerJobs: number | null
  channels: readonly DeliveryChannel[]
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    members: 1,
    providers: 1,
    externalEventsPerMonth: 500,
    controllerJobs: 0,
    channels: ['dashboard', 'telegram'],
  },
  pro: {
    members: 5,
    providers: 5,
    externalEventsPerMonth: 5_000,
    controllerJobs: 5,
    channels: ['dashboard', 'telegram', 'slack'],
  },
  growth: {
    members: null,
    providers: null,
    externalEventsPerMonth: 50_000,
    controllerJobs: null,
    channels: ['dashboard', 'telegram', 'slack'],
  },
}

export function normalizePlan(plan: string | null | undefined): Plan {
  return plan === 'pro' || plan === 'growth' ? plan : 'free'
}

export function limitsFor(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[normalizePlan(plan)]
}

export function canUseChannel(plan: string | null | undefined, channel: DeliveryChannel) {
  return limitsFor(plan).channels.includes(channel)
}

export function canUseMcpTool(plan: string | null | undefined) {
  return normalizePlan(plan) === 'growth'
}

export function canInviteMember(plan: string | null | undefined, occupiedSeats: number) {
  const limit = limitsFor(plan).members
  return limit === null || occupiedSeats < limit
}

export function canConfigureProvider(plan: string | null | undefined, configuredProviders: number) {
  const limit = limitsFor(plan).providers
  return limit === null || configuredProviders < limit
}
