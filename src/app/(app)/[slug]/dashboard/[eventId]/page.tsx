import { EventDetail } from '@/components/EventDetail'
import { PageHeader } from '@/components/PageHeader'

interface EventDetailPageProps {
  params: Promise<{ slug: string; eventId: string }>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug, eventId } = await params
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Event Detail"
        breadcrumb={{ label: 'Events', href: `/${slug}/dashboard` }}
      />
      <div className="px-6 py-6">
        <EventDetail eventId={eventId} />
      </div>
    </div>
  )
}
