'use client'

import { useEffect, useState, useCallback } from 'react'
import { EventCard, type Event } from '@/components/EventCard'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Filters } from '@/components/FilterBar'
import { useTenant } from '@/components/TenantProvider'

interface ApiResponse {
  events: Event[]
  nextCursor: string | null
  totalCount: number
  recentCount: number
}

interface EventTimelineProps {
  filters: Filters
  onRecentCount?: (count: number) => void
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function buildUrl(slug: string, filters: Filters, page: number, pageSize: number): string {
  const params = new URLSearchParams()
  if (filters.source) params.set('source', filters.source)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.category) params.set('category', filters.category)
  if (filters.status) params.set('status', filters.status)
  params.set('limit', String(pageSize))
  params.set('offset', String((page - 1) * pageSize))
  const qs = params.toString()
  return `/api/${slug}/events${qs ? `?${qs}` : ''}`
}

export function EventTimeline({ filters, onRecentCount }: EventTimelineProps) {
  const { tenant } = useTenant()
  const [events, setEvents] = useState<Event[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyEvent, setBusyEvent] = useState<{ id: string; action: 'archive' | 'delete' } | null>(null)

  const fetchCurrentPage = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(buildUrl(tenant.slug, filters, page, pageSize))
      if (!res.ok) throw new Error('Failed to fetch events')
      const data: ApiResponse = await res.json()
      setEvents(data.events)
      setTotalCount(data.totalCount)
      onRecentCount?.(data.recentCount)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [filters, onRecentCount, page, pageSize, tenant.slug])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(buildUrl(tenant.slug, filters, 1, pageSize))
      if (!res.ok) return
      const data: ApiResponse = await res.json()
      onRecentCount?.(data.recentCount)
      setTotalCount(data.totalCount)
      if (page === 1) {
        setEvents(data.events)
      }
    } catch {
    }
  }, [filters, onRecentCount, page, pageSize, tenant.slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCurrentPage()
  }, [fetchCurrentPage])

  useEffect(() => {
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [poll])

  async function archiveEvent(event: Event) {
    setBusyEvent({ id: event.id, action: 'archive' })
    try {
      const res = await fetch(`/api/${tenant.slug}/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      })
      if (!res.ok) throw new Error('Failed to archive event')
      if (events.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1))
      } else {
        await fetchCurrentPage()
      }
    } catch {
      setError('Failed to archive event')
    } finally {
      setBusyEvent(null)
    }
  }

  async function deleteEvent(event: Event) {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    setBusyEvent({ id: event.id, action: 'delete' })
    try {
      const res = await fetch(`/api/${tenant.slug}/events/${event.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete event')
      if (events.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1))
      } else {
        await fetchCurrentPage()
      }
    } catch {
      setError('Failed to delete event')
    } finally {
      setBusyEvent(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = totalCount === 0 ? 0 : pageStart + events.length - 1

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Loading events…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (events.length === 0 && totalCount === 0) {
    return (
      <div className="flex flex-col gap-3">
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalCount={totalCount}
          pageStart={pageStart}
          pageEnd={pageEnd}
          onPageSize={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        />
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No events yet. Send a webhook to get started.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PaginationControls
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={totalCount}
        pageStart={pageStart}
        pageEnd={pageEnd}
        onPageSize={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
      />
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          slug={tenant.slug}
          busyAction={busyEvent?.id === event.id ? busyEvent.action : null}
          onArchive={archiveEvent}
          onDelete={deleteEvent}
        />
      ))}
      <PaginationControls
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={totalCount}
        pageStart={pageStart}
        pageEnd={pageEnd}
        onPageSize={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
      />
    </div>
  )
}

interface PaginationControlsProps {
  page: number
  pageSize: number
  totalPages: number
  totalCount: number
  pageStart: number
  pageEnd: number
  onPageSize: (size: number) => void
  onPrevious: () => void
  onNext: () => void
}

function PaginationControls({
  page,
  pageSize,
  totalPages,
  totalCount,
  pageStart,
  pageEnd,
  onPageSize,
  onPrevious,
  onNext,
}: PaginationControlsProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        {totalCount > 0 ? (
          <span>
            Showing {pageStart}-{pageEnd} of {totalCount}
          </span>
        ) : (
          <span>No events match these filters</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs">Rows</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSize(Number(value))}>
          <SelectTrigger size="sm" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={page <= 1}>
          Previous
        </Button>
        <span className="min-w-16 text-center text-xs">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  )
}
