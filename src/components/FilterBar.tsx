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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Source"
          defaultValue={filters.source ?? ''}
          className={`w-36 pl-8 ${filters.source ? 'ring-1 ring-primary/40' : ''}`}
          onChange={(e) => updateParam('source', e.target.value)}
        />
      </div>

      <Select
        value={filters.severity ?? ''}
        onValueChange={(val) => updateParam('severity', !val || val === 'all' ? '' : val)}
      >
        <SelectTrigger className={`w-36 ${filters.severity ? 'ring-1 ring-primary/40' : ''}`}>
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

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Category"
          defaultValue={filters.category ?? ''}
          className={`w-36 pl-8 ${filters.category ? 'ring-1 ring-primary/40' : ''}`}
          onChange={(e) => updateParam('category', e.target.value)}
        />
      </div>

      <Select
        value={filters.status ?? ''}
        onValueChange={(val) => updateParam('status', !val || val === 'all' ? '' : val)}
      >
        <SelectTrigger className={`w-40 ${filters.status ? 'ring-1 ring-primary/40' : ''}`}>
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
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </>
      )}
    </div>
  )
}
