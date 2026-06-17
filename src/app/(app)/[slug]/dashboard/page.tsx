import { count, eq, and, inArray, not } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { getServerTenantId } from '@/lib/tenancy'
import { DashboardClient } from '@/components/DashboardClient'
import { PageHeader } from '@/components/PageHeader'

interface DashboardPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    source?: string
    severity?: string
    category?: string
    status?: string
  }>
}

async function getEventCounts(tenantId: string) {
  const [openResult] = await db
    .select({ value: count() })
    .from(events)
    .where(and(eq(events.tenantId, tenantId), eq(events.status, 'open')))

  const [criticalResult] = await db
    .select({ value: count() })
    .from(events)
    .where(and(
      eq(events.tenantId, tenantId),
      eq(events.severity, 'critical'),
      not(inArray(events.status, ['resolved', 'dismissed']))
    ))

  return {
    openCount: openResult?.value ?? 0,
    criticalCount: criticalResult?.value ?? 0,
  }
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { slug } = await params
  const raw = await searchParams
  const filters = {
    source:   raw.source,
    severity: raw.severity,
    category: raw.category,
    status:   raw.status,
  }

  const tenantId = await getServerTenantId(slug)
  const { openCount, criticalCount } = tenantId
    ? await getEventCounts(tenantId)
    : { openCount: 0, criticalCount: 0 }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Events" />
      <div className="px-4 py-6 sm:px-6">
        <DashboardClient
          initialFilters={filters}
          openCount={openCount}
          criticalCount={criticalCount}
        />
      </div>
    </div>
  )
}
