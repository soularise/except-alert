import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { getServerTenantId } from '@/lib/tenancy'
import { EventDetail } from '@/components/EventDetail'
import { PageHeader } from '@/components/PageHeader'

interface EventDetailPageProps {
  params: Promise<{ slug: string; eventId: string }>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug, eventId } = await params

  const tenantId = await getServerTenantId(slug)
  let title = 'Event Detail'
  if (tenantId) {
    const [row] = await db
      .select({ title: events.title })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
      .limit(1)
    if (row) title = row.title
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={title}
        breadcrumb={{ label: 'Events', href: `/${slug}/dashboard` }}
      />
      <div className="px-6 py-6">
        <EventDetail eventId={eventId} />
      </div>
    </div>
  )
}
