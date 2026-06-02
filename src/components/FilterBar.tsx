'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export interface Filters {
  source?: string
  severity?: string
  category?: string
  status?: string
}

interface FilterBarProps {
  filters: Filters
}

export function FilterBar({ filters }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  function clearFilters() {
    router.push('?')
  }

  const hasFilters = !!(filters.source || filters.severity || filters.category || filters.status)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Source"
        defaultValue={filters.source ?? ''}
        className="w-36"
        onChange={(e) => updateParam('source', e.target.value)}
      />

      <Select
        value={filters.severity ?? ''}
        onValueChange={(val) => updateParam('severity', !val || val === 'all' ? '' : val)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All severities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="info">Info</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="Category"
        defaultValue={filters.category ?? ''}
        className="w-36"
        onChange={(e) => updateParam('category', e.target.value)}
      />

      <Select
        value={filters.status ?? ''}
        onValueChange={(val) => updateParam('status', !val || val === 'all' ? '' : val)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="acknowledged">Acknowledged</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="dismissed">Dismissed</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
