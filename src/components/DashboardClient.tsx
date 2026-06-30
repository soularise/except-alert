'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, PlugZap, Send } from 'lucide-react'
import { FilterBar, type Filters } from '@/components/FilterBar'
import { EventTimeline } from '@/components/EventTimeline'
import { SummaryTiles } from '@/components/SummaryTiles'
import { useTenant } from '@/components/TenantProvider'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DashboardClientProps {
  initialFilters: Filters
  openCount: number
  criticalCount: number
  totalEventCount: number
  configuredProviderCount: number
}

export function DashboardClient({
  initialFilters,
  openCount,
  criticalCount,
  totalEventCount,
  configuredProviderCount,
}: DashboardClientProps) {
  const [recentCount, setRecentCount] = useState<number>(0)
  const filtersKey = JSON.stringify(initialFilters)
  const showActivationPanel = totalEventCount === 0

  return (
    <div className="flex flex-col gap-6">
      <SummaryTiles
        openCount={openCount}
        criticalCount={criticalCount}
        recentCount={recentCount}
      />
      {showActivationPanel && (
        <DashboardActivationPanel configuredProviderCount={configuredProviderCount} />
      )}
      <FilterBar filters={initialFilters} />
      <EventTimeline
        key={filtersKey}
        filters={initialFilters}
        onRecentCount={setRecentCount}
        suppressEmptyState={showActivationPanel}
      />
    </div>
  )
}

function DashboardActivationPanel({
  configuredProviderCount,
}: {
  configuredProviderCount: number
}) {
  const { tenant } = useTenant()
  const hasSource = configuredProviderCount > 0
  const steps = [
    {
      label: 'Create one source',
      done: hasSource,
      detail: hasSource
        ? 'A source is ready to receive webhooks.'
        : 'Free workspaces include one configured source.',
    },
    {
      label: 'Send a test event',
      done: false,
      detail: hasSource
        ? 'Open the source and use Send Test Event.'
        : 'Save a source first, then send a test event.',
    },
  ]

  return (
    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <PlugZap className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Finish Free setup</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map((step) => {
              const Icon = step.done ? CheckCircle2 : Circle
              return (
                <div key={step.label} className="flex min-w-0 gap-2 rounded-md bg-muted/35 px-3 py-2">
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      step.done ? 'text-green-600' : 'text-muted-foreground'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Link
            href={`/${tenant.slug}/settings/providers`}
            className={buttonVariants({ variant: 'default', size: 'sm' })}
          >
            {hasSource ? <Send data-icon="inline-start" /> : <PlugZap data-icon="inline-start" />}
            {hasSource ? 'Send Test Event' : 'Configure Source'}
          </Link>
          <Link
            href={`/${tenant.slug}/settings/providers`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Sources
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </div>
    </section>
  )
}
