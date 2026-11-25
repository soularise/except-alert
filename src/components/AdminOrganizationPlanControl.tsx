'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PLAN_LABELS, normalizePlan, type Plan } from '@/lib/plan-limits'

const PLAN_OPTIONS: Plan[] = ['free', 'pro', 'growth']

type AdminOrganizationPlanControlProps = {
  organizationId: string
  organizationName: string
  plan: string
}

export function AdminOrganizationPlanControl({
  organizationId,
  organizationName,
  plan,
}: AdminOrganizationPlanControlProps) {
  const router = useRouter()
  const currentPlan = normalizePlan(plan)
  const [selectedPlan, setSelectedPlan] = useState<Plan>(currentPlan)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function savePlan() {
    if (selectedPlan === currentPlan) return
    if (
      !window.confirm(
        `Change ${organizationName} from ${PLAN_LABELS[currentPlan]} to ${PLAN_LABELS[selectedPlan]}?`
      )
    ) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not change plan.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change plan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <select
          aria-label={`Plan for ${organizationName}`}
          value={selectedPlan}
          onChange={(event) => setSelectedPlan(event.target.value as Plan)}
          disabled={saving}
          className="h-8 rounded-md border border-input bg-input/25 px-2 text-sm"
        >
          {PLAN_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {PLAN_LABELS[option]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={saving || selectedPlan === currentPlan}
          onClick={savePlan}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
