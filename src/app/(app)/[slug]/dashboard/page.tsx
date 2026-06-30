import { count, eq, and, inArray, not } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events, tenantProviders } from '@/lib/db/schema'
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

async function getDashboardCounts(tenantId: string) {
  const [openResult, criticalResult, totalResult, configuredProviderResult] = await Promise.all([
    db
      .select({ value: count() })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.status, 'open')))
      .then(([result]) => result),
    db
      .select({ value: count() })
      .from(events)
      .where(and(
        eq(events.tenantId, tenantId),
        eq(events.severity, 'critical'),
        not(inArray(events.status, ['resolved', 'dismissed']))
      ))
      .then(([result]) => result),
    db
      .select({ value: count() })
      .from(events)
      .where(eq(events.tenantId, tenantId))
      .then(([result]) => result),
    db
      .select({ value: count() })
      .from(tenantProviders)
      .where(eq(tenantProviders.tenantId, tenantId))
      .then(([result]) => result),
  ])

  return {
    openCount: openResult?.value ?? 0,
    criticalCount: criticalResult?.value ?? 0,
    totalEventCount: totalResult?.value ?? 0,
    configuredProviderCount: configuredProviderResult?.value ?? 0,
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
  const { openCount, criticalCount, totalEventCount, configuredProviderCount } = tenantId
    ? await getDashboardCounts(tenantId)
    : { openCount: 0, criticalCount: 0, totalEventCount: 0, configuredProviderCount: 0 }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Events" />
      <div className="px-4 py-6 sm:px-6">
        <DashboardClient
          initialFilters={filters}
          openCount={openCount}
          criticalCount={criticalCount}
          totalEventCount={totalEventCount}
          configuredProviderCount={configuredProviderCount}
        />
      </div>
    </div>
  )
}
