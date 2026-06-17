'use client'

import { useState } from 'react'
import { FilterBar, type Filters } from '@/components/FilterBar'
import { EventTimeline } from '@/components/EventTimeline'
import { SummaryTiles } from '@/components/SummaryTiles'

interface DashboardClientProps {
  initialFilters: Filters
  openCount: number
  criticalCount: number
}

export function DashboardClient({ initialFilters, openCount, criticalCount }: DashboardClientProps) {
  const [recentCount, setRecentCount] = useState<number>(0)
  const filtersKey = JSON.stringify(initialFilters)

  return (
    <div className="flex flex-col gap-6">
      <SummaryTiles
        openCount={openCount}
        criticalCount={criticalCount}
        recentCount={recentCount}
      />
      <FilterBar filters={initialFilters} />
      <EventTimeline key={filtersKey} filters={initialFilters} onRecentCount={setRecentCount} />
    </div>
  )
}
