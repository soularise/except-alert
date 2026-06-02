'use client'

import { useState } from 'react'
import { FilterBar, type Filters } from '@/components/FilterBar'
import { EventTimeline } from '@/components/EventTimeline'
import { Badge } from '@/components/ui/badge'

interface DashboardClientProps {
  initialFilters: Filters
}

export function DashboardClient({ initialFilters }: DashboardClientProps) {
  const [recentCount, setRecentCount] = useState<number>(0)
  const [filters] = useState<Filters>(initialFilters)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ExceptAlert</h1>
          <p className="text-sm text-muted-foreground">Webhook event monitor</p>
        </div>
        {recentCount > 0 && (
          <Badge className="bg-blue-500 text-white border-transparent">
            {recentCount} event{recentCount !== 1 ? 's' : ''} in last 60s
          </Badge>
        )}
      </div>

      <FilterBar filters={filters} />

      <EventTimeline filters={filters} onRecentCount={setRecentCount} />
    </div>
  )
}
