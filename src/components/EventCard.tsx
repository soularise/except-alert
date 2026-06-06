import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { SeverityBadge } from '@/components/SeverityBadge'
import { StatusBadge } from '@/components/StatusBadge'

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

export function EventCard({ event, slug }: { event: Event; slug: string }) {
  return (
    <Link href={`/${slug}/dashboard/${event.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="hover:ring-foreground/20 transition-shadow cursor-pointer">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <SeverityBadge severity={event.severity} />
            <StatusBadge status={event.status ?? 'open'} />
          </div>
          <p className="font-semibold text-sm leading-snug">{event.title}</p>
          {event.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60" />
              {event.source}
            </span>
            <span>{event.category}</span>
            <span className="ml-auto">{formatRelativeTime(event.receivedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
