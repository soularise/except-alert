import { EventDetail } from '@/components/EventDetail'

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params
  return <EventDetail eventId={eventId} />
}
