import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { EventDetail } from '@/components/EventDetail'

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params
  return (
    <div className="px-6 py-6">
      <Link
        href="/dashboard"
        className="mb-4 flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-300 transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Events
      </Link>
      <EventDetail eventId={eventId} />
    </div>
  )
}
