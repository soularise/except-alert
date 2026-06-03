'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SeverityBadge } from '@/components/SeverityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { HitlActionPanel } from '@/components/HitlActionPanel'

interface EventData {
  id: string
  hookId: string
  source: string
  severity: string
  title: string
  description: string | null
  category: string
  tags: unknown
  payload: unknown
  occurredAt: string
  receivedAt: string
  status: string | null
}

interface AuditEntry {
  id: number
  hookId: string
  providerId: string
  status: string
  errorInfo: unknown
  receivedAt: string
  processedAt: string | null
  deliveredAt: string | null
  schemaName: string | null
  mappingName: string | null
}

interface EventDetailData {
  event: EventData
  auditLog: AuditEntry[]
}

const VALID_STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'] as const

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

export function EventDetail({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Event not found' : 'Failed to load event')
        return res.json() as Promise<EventDetailData>
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [eventId])

  async function updateStatus(status: string) {
    if (!data) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      const { event } = (await res.json()) as { event: EventData }
      setData((prev) => (prev ? { ...prev, event } : prev))
    } catch {
      // status update failed silently — user can retry
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading event…</p>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">{error ?? 'Event not found'}</p>
    )
  }

  const { event, auditLog } = data

  const normalizedView = {
    title: event.title,
    description: event.description,
    category: event.category,
    source: event.source,
    severity: event.severity,
    tags: event.tags,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={event.severity} />
          <StatusBadge status={event.status ?? 'open'} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Source:</span> {event.source}
          </span>
          <span>
            <span className="font-medium text-foreground">Category:</span> {event.category}
          </span>
          <span>
            <span className="font-medium text-foreground">Hook ID:</span> {event.hookId}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Received:</span>{' '}
            {formatDateTime(event.receivedAt)}
          </span>
          <span>
            <span className="font-medium text-foreground">Occurred:</span>{' '}
            {formatDateTime(event.occurredAt)}
          </span>
        </div>
      </div>

      <Separator />

      {/* Status controls */}
      <Card>
        <CardHeader>
          <CardTitle>Update Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VALID_STATUSES.map((s) => (
              <Button
                key={s}
                variant={event.status === s ? 'default' : 'outline'}
                size="sm"
                disabled={updating || event.status === s}
                onClick={() => updateStatus(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* HITL Actions */}
      <HitlActionPanel
        eventId={event.id}
        category={event.category}
        onStatusChange={() => {
          fetch(`/api/events/${eventId}`)
            .then((res) => {
              if (!res.ok) throw new Error('Failed to reload event')
              return res.json() as Promise<EventDetailData>
            })
            .then(setData)
            .catch(() => {})
        }}
      />

      {/* Normalized fields */}
      <Card>
        <CardHeader>
          <CardTitle>Normalized Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {(
              [
                ['Title', event.title],
                ['Description', event.description ?? '—'],
                ['Category', event.category],
                ['Source', event.source],
                ['Severity', event.severity],
                ['Tags', JSON.stringify(event.tags)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <>
                <dt key={`dt-${label}`} className="font-medium text-muted-foreground whitespace-nowrap">
                  {label}
                </dt>
                <dd key={`dd-${label}`} className="text-foreground break-words">
                  {value}
                </dd>
              </>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Raw vs Normalized diff */}
      <Card>
        <CardHeader>
          <CardTitle>Raw vs Normalized</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Raw Payload
              </p>
              <pre className="bg-muted rounded p-4 text-xs overflow-auto max-h-80 font-mono">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Normalized
              </p>
              <pre className="bg-muted rounded p-4 text-xs overflow-auto max-h-80 font-mono">
                {JSON.stringify(normalizedView, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>Mapping</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell>{entry.schemaName ?? '—'}</TableCell>
                    <TableCell>{entry.mappingName ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(entry.receivedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.processedAt ? formatDateTime(entry.processedAt) : '—'}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-destructive">
                      {entry.errorInfo ? JSON.stringify(entry.errorInfo) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
