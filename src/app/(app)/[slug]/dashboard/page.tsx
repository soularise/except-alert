import { count, eq, and, inArray, not, notInArray, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events, tenantProviders, tenants } from '@/lib/db/schema'
import { getMonthlyExternalEventUsage } from '@/lib/event-usage'
import { limitsFor } from '@/lib/plan-limits'
import { HEARTBEAT_PROVIDER_IDS, wantsHeartbeats } from '@/lib/providers'
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
    includeHeartbeats?: string
  }>
}

async function getDashboardCounts(tenantId: string, includeHeartbeats: boolean) {
  const hideHeartbeats: SQL | undefined = includeHeartbeats
    ? undefined
    : notInArray(events.source, HEARTBEAT_PROVIDER_IDS)

  const [
    openResult,
    criticalResult,
    totalResult,
    configuredProviderResult,
    tenantResult,
    monthlyExternalEventUsage,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.status, 'open'), hideHeartbeats))
      .then(([result]) => result),
    db
      .select({ value: count() })
      .from(events)
      .where(and(
        eq(events.tenantId, tenantId),
        eq(events.severity, 'critical'),
        not(inArray(events.status, ['resolved', 'dismissed'])),
        hideHeartbeats
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
    db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .then(([result]) => result),
    getMonthlyExternalEventUsage(tenantId),
  ])

  const externalEventsPerMonth = limitsFor(tenantResult?.plan).externalEventsPerMonth

  return {
    openCount: openResult?.value ?? 0,
    criticalCount: criticalResult?.value ?? 0,
    totalEventCount: totalResult?.value ?? 0,
    configuredProviderCount: configuredProviderResult?.value ?? 0,
    currentMonthlyExternalEventCount: monthlyExternalEventUsage,
    externalEventsPerMonth,
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
    includeHeartbeats: raw.includeHeartbeats,
  }

  const tenantId = await getServerTenantId(slug)
  const {
    openCount,
    criticalCount,
    totalEventCount,
    configuredProviderCount,
    currentMonthlyExternalEventCount,
    externalEventsPerMonth,
  } = tenantId
    ? await getDashboardCounts(tenantId, wantsHeartbeats(filters.includeHeartbeats))
    : {
        openCount: 0,
        criticalCount: 0,
        totalEventCount: 0,
        configuredProviderCount: 0,
        currentMonthlyExternalEventCount: 0,
        externalEventsPerMonth: limitsFor(null).externalEventsPerMonth,
      }

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
          currentMonthlyExternalEventCount={currentMonthlyExternalEventCount}
          externalEventsPerMonth={externalEventsPerMonth}
        />
      </div>
    </div>
  )
}
