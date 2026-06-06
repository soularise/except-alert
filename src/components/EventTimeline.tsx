'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { EventCard, type Event } from '@/components/EventCard'
import { Button } from '@/components/ui/button'
import type { Filters } from '@/components/FilterBar'
import { useTenant } from '@/components/TenantProvider'

interface ApiResponse {
  events: Event[]
  nextCursor: string | null
  recentCount: number
}

interface EventTimelineProps {
  filters: Filters
  onRecentCount?: (count: number) => void
}

function buildUrl(slug: string, filters: Filters, cursor?: string | null): string {
  const params = new URLSearchParams()
  if (filters.source) params.set('source', filters.source)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.category) params.set('category', filters.category)
  if (filters.status) params.set('status', filters.status)
  if (cursor) params.set('cursor', cursor)
  const qs = params.toString()
  return `/api/${slug}/events${qs ? `?${qs}` : ''}`
}

export function EventTimeline({ filters, onRecentCount }: EventTimelineProps) {
  const { tenant } = useTenant()
  const [events, setEvents] = useState<Event[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const newestReceivedAt = useRef<string | null>(null)

  const fetchInitial = useCallback(async () => {
    setLoading(true)
    setEvents([])
    setNextCursor(null)
    newestReceivedAt.current = null
    try {
      const res = await fetch(buildUrl(tenant.slug, filters))
      if (!res.ok) throw new Error('Failed to fetch events')
      const data: ApiResponse = await res.json()
      setEvents(data.events)
      setNextCursor(data.nextCursor)
      if (data.events.length > 0) {
        newestReceivedAt.current = data.events[0].receivedAt
      }
      onRecentCount?.(data.recentCount)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [filters, onRecentCount, tenant.slug])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(buildUrl(tenant.slug, filters))
      if (!res.ok) return
      const data: ApiResponse = await res.json()
      onRecentCount?.(data.recentCount)

      if (data.events.length === 0) return

      const newest = newestReceivedAt.current
      if (!newest) {
        setEvents(data.events)
        setNextCursor(data.nextCursor)
        newestReceivedAt.current = data.events[0].receivedAt
        return
      }

      const newEvents = data.events.filter(
        (e) => new Date(e.receivedAt) > new Date(newest)
      )
      if (newEvents.length > 0) {
        newestReceivedAt.current = newEvents[0].receivedAt
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id))
          const deduped = newEvents.filter((e) => !existingIds.has(e.id))
          return [...deduped, ...prev]
        })
      }
    } catch {
    }
  }, [filters, onRecentCount, tenant.slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInitial()
  }, [fetchInitial])

  useEffect(() => {
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [poll])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const res = await fetch(buildUrl(tenant.slug, filters, nextCursor))
      if (!res.ok) throw new Error('Failed to load more')
      const data: ApiResponse = await res.json()
      setEvents((prev) => [...prev, ...data.events])
      setNextCursor(data.nextCursor)
    } catch {
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
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

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No events yet. Send a webhook to get started.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => (
        <EventCard key={event.id} event={event} slug={tenant.slug} />
      ))}
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
