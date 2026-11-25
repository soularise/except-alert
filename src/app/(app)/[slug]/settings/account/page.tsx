'use client'

import { AccountSettings } from '@/components/AccountSettings'
import { useTenant } from '@/components/TenantProvider'
import { UpgradeRequestButton } from '@/components/UpgradeRequestButton'
import { PLAN_LABELS, limitsFor, nextUpgradePlans, normalizePlan } from '@/lib/plan-limits'

function formatLimit(value: number | null, unit: string) {
  return value === null ? `Unlimited ${unit}` : `${value.toLocaleString()} ${unit}`
}

export default function AccountSettingsPage() {
  const { tenant, role, authDisabled } = useTenant()
  const plan = normalizePlan(tenant.plan)
  const limits = limitsFor(plan)
  const canRequest = role === 'owner' || role === 'admin'
  const nextPlans = nextUpgradePlans(plan)

  return (
    <div className="w-full space-y-6">
      <section id="plan" className="max-w-3xl space-y-3 rounded-md border border-border/70 bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant.name} is on the <span className="font-medium text-foreground">{PLAN_LABELS[plan]}</span> plan.
          </p>
        </div>
        <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <li>{formatLimit(limits.members, 'members')}</li>
          <li>{formatLimit(limits.providers, 'sources')}</li>
          <li>{formatLimit(limits.externalEventsPerMonth, 'external events per month')}</li>
          <li>{formatLimit(limits.controllerJobs, 'controller jobs')}</li>
        </ul>
        {nextPlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">This is the highest plan.</p>
        ) : canRequest ? (
          <UpgradeRequestButton
            slug={tenant.slug}
            source="settings_plan"
            prompt={`We would like to move to ${PLAN_LABELS[nextPlans[0]]}.`}
            currentPlan={plan}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Ask an owner or admin to request an upgrade.</p>
        )}
      </section>

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and password.
        </p>
      </div>
      <AccountSettings authDisabled={authDisabled} />
    </div>
  )
}
