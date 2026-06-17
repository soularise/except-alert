'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

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
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Source"
          value={filters.source ?? ''}
          className={`w-full pl-8 sm:w-36 ${filters.source ? 'ring-1 ring-primary/40' : ''}`}
          onChange={(e) => updateParam('source', e.target.value)}
        />
      </div>

      <Select
        value={filters.severity ?? ''}
        onValueChange={(val) => updateParam('severity', !val || val === 'all' ? '' : val)}
      >
        <SelectTrigger className={`w-full sm:w-36 ${filters.severity ? 'ring-1 ring-primary/40' : ''}`}>
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

      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Category"
          value={filters.category ?? ''}
          className={`w-full pl-8 sm:w-36 ${filters.category ? 'ring-1 ring-primary/40' : ''}`}
          onChange={(e) => updateParam('category', e.target.value)}
        />
      </div>

      <Select
        value={filters.status ?? ''}
        onValueChange={(val) => updateParam('status', !val || val === 'all' ? '' : val)}
      >
        <SelectTrigger className={`w-full sm:w-40 ${filters.status ? 'ring-1 ring-primary/40' : ''}`}>
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
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}
