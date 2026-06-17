import Link from 'next/link'
import { Archive, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'

export interface Event {
  id: string
  hookId: string
  source: string
  severity: string
  title: string
  description: string | null
  category: string
  tags: unknown
  receivedAt: string
  occurredAt: string
  status: string | null
}

const severityStripe: Record<string, string> = {
  critical: 'border-l-red-600',
  error:    'border-l-orange-500',
  warning:  'border-l-yellow-500',
  info:     'border-l-blue-500',
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return diffSec <= 1 ? 'just now' : `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

interface EventCardProps {
  event: Event
  slug: string
  busyAction?: 'archive' | 'delete' | null
  onArchive?: (event: Event) => void
  onDelete?: (event: Event) => void
}

export function EventCard({
  event,
  slug,
  busyAction = null,
  onArchive,
  onDelete,
}: EventCardProps) {
  const stripe = severityStripe[event.severity] ?? 'border-l-border'

  return (
    <Card
      className={cn(
        'border-l-4 border-border/50 shadow-sm transition-shadow hover:shadow-md',
        stripe
      )}
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Link
            href={`/${slug}/dashboard/${event.id}`}
            className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-sm font-semibold leading-snug text-foreground">{event.title}</p>
            {event.description && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {event.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60" />
                {event.source}
              </span>
              <span>{event.category}</span>
              <span className="sm:ml-auto">{formatRelativeTime(event.receivedAt)}</span>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <StatusBadge status={event.status ?? 'open'} />
            {onArchive && event.status !== 'dismissed' && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Archive event"
                aria-label={`Archive ${event.title}`}
                disabled={Boolean(busyAction)}
                onClick={() => onArchive(event)}
              >
                <Archive className="size-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                title="Delete event"
                aria-label={`Delete ${event.title}`}
                disabled={Boolean(busyAction)}
                onClick={() => onDelete(event)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
