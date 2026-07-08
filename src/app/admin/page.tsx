import { notFound, redirect } from 'next/navigation'
import { and, count, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm'
import { AppSidebar } from '@/components/AppSidebar'
import { Badge } from '@/components/ui/badge'
import { isPlatformAdminEmail } from '@/lib/admin'
import { db } from '@/lib/db'
import {
  authSession,
  authUser,
  events,
  tenantMemberships,
  tenantProviders,
  tenants,
} from '@/lib/db/schema'
import { getFirstTenantForUser, getServerSession } from '@/lib/tenancy'

type Timeframe = '7d' | '30d' | '90d' | 'all'
type PlanFilter = 'all' | 'free' | 'pro' | 'growth'

const TIMEFRAMES: Array<{ value: Timeframe; label: string; days: number | null }> = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: null },
]

const PLANS: Array<{ value: PlanFilter; label: string }> = [
  { value: 'all', label: 'All plans' },
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'growth', label: 'Growth' },
]

type AdminSearchParams = Promise<{
  timeframe?: string
  plan?: string
}>

type OrganizationRow = {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: Date
  ownerName: string | null
  ownerEmail: string | null
  memberCount: number
  configuredSourceCount: number
  eventCount: number
  latestMemberActivity: Date | string | null
}

type UserRow = {
  id: string
  name: string
  email: string
  createdAt: Date
  latestSessionActivity: Date | string | null
  memberships: string | null
  activeEventCount: number
}

type SummaryMetrics = {
  totalOrganizations: number
  paidOrganizations: number
  activeUsers: number
  externalEvents: number
  configuredSources: number
}

function normalizeTimeframe(value: string | undefined): Timeframe {
  return value === '7d' || value === '90d' || value === 'all' ? value : '30d'
}

function normalizePlan(value: string | undefined): PlanFilter {
  return value === 'free' || value === 'pro' || value === 'growth' ? value : 'all'
}

function sinceFor(timeframe: Timeframe) {
  const option = TIMEFRAMES.find((item) => item.value === timeframe)
  if (!option?.days) return null
  const since = new Date()
  since.setDate(since.getDate() - option.days)
  return since
}

function planConditions(plan: PlanFilter): SQL[] {
  return plan === 'all' ? [] : [eq(tenants.plan, plan)]
}

function externalEventConditions(since: Date | null): SQL[] {
  const conditions: SQL[] = [
    sql`${events.hookId} LIKE 'hook_%'`,
    sql`${events.source} <> 'auth'`,
    sql`${events.category} <> 'test'`,
    sql`COALESCE(${events.tags}->>'test', 'false') <> 'true'`,
  ]
  if (since) conditions.push(gte(events.receivedAt, since))
  return conditions
}

function formatNumber(value: number) {
  return value.toLocaleString()
}

function coerceDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: Date | string | null | undefined) {
  const date = coerceDate(value)
  if (!date) return 'Never'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value: Date | string | null | undefined) {
  const date = coerceDate(value)
  if (!date) return 'Never'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function isActiveInWindow(row: UserRow, since: Date | null) {
  const latestSessionActivity = coerceDate(row.latestSessionActivity)
  if (!since) return Boolean(latestSessionActivity || row.activeEventCount > 0)
  return Boolean(
    row.activeEventCount > 0 ||
      (latestSessionActivity && latestSessionActivity >= since)
  )
}

async function getSummaryMetrics(since: Date | null, plan: PlanFilter): Promise<SummaryMetrics> {
  const tenantWhere = and(...planConditions(plan))
  const paidWhere = and(
    inArray(tenants.plan, ['pro', 'growth']),
    ...planConditions(plan)
  )
  const eventWhere = and(...externalEventConditions(since), ...planConditions(plan))

  const [
    totalOrganizations,
    paidOrganizations,
    activeUsers,
    externalEvents,
    configuredSources,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(tenants)
      .where(tenantWhere)
      .then(([row]) => row?.value ?? 0),
    db
      .select({ value: count() })
      .from(tenants)
      .where(paidWhere)
      .then(([row]) => row?.value ?? 0),
    db
      .select({ value: count(sql`DISTINCT ${authSession.userId}`) })
      .from(authSession)
      .innerJoin(authUser, eq(authSession.userId, authUser.id))
      .innerJoin(tenantMemberships, eq(tenantMemberships.userId, authUser.id))
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .where(and(...(since ? [gte(authSession.updatedAt, since)] : []), ...planConditions(plan)))
      .then(([row]) => row?.value ?? 0),
    db
      .select({ value: count(sql`DISTINCT ${events.id}`) })
      .from(events)
      .innerJoin(tenants, eq(events.tenantId, tenants.id))
      .where(eventWhere)
      .then(([row]) => row?.value ?? 0),
    db
      .select({ value: count(sql`DISTINCT ${tenantProviders.id}`) })
      .from(tenantProviders)
      .innerJoin(tenants, eq(tenantProviders.tenantId, tenants.id))
      .where(tenantWhere)
      .then(([row]) => row?.value ?? 0),
  ])

  return {
    totalOrganizations,
    paidOrganizations,
    activeUsers,
    externalEvents,
    configuredSources,
  }
}

async function getOrganizationRows(since: Date | null, plan: PlanFilter): Promise<OrganizationRow[]> {
  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      plan: tenants.plan,
      createdAt: tenants.createdAt,
      ownerName: sql<string | null>`MAX(${authUser.name}) FILTER (WHERE ${tenantMemberships.role} = 'owner')`,
      ownerEmail: sql<string | null>`MAX(${authUser.email}) FILTER (WHERE ${tenantMemberships.role} = 'owner')`,
      memberCount: count(sql`DISTINCT ${tenantMemberships.userId}`),
      configuredSourceCount: count(sql`DISTINCT ${tenantProviders.id}`),
      eventCount: count(sql`DISTINCT ${events.id}`),
      latestMemberActivity: sql<Date | null>`MAX(${authSession.updatedAt})`,
    })
    .from(tenants)
    .leftJoin(tenantMemberships, eq(tenantMemberships.tenantId, tenants.id))
    .leftJoin(authUser, eq(authUser.id, tenantMemberships.userId))
    .leftJoin(authSession, eq(authSession.userId, authUser.id))
    .leftJoin(tenantProviders, eq(tenantProviders.tenantId, tenants.id))
    .leftJoin(
      events,
      and(eq(events.tenantId, tenants.id), ...externalEventConditions(since))
    )
    .where(and(...planConditions(plan)))
    .groupBy(tenants.id)
    .orderBy(sql`MAX(${authSession.updatedAt}) DESC NULLS LAST`, desc(tenants.createdAt))
}

async function getUserRows(since: Date | null, plan: PlanFilter): Promise<UserRow[]> {
  return db
    .select({
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      createdAt: authUser.createdAt,
      latestSessionActivity: sql<Date | null>`MAX(${authSession.updatedAt})`,
      memberships: sql<string | null>`
        ARRAY_TO_STRING(
          ARRAY_AGG(DISTINCT ${tenants.name} || ' (' || ${tenantMemberships.role} || ')'),
          ', '
        )
      `,
      activeEventCount: count(sql`DISTINCT ${events.id}`),
    })
    .from(authUser)
    .leftJoin(authSession, eq(authSession.userId, authUser.id))
    .innerJoin(tenantMemberships, eq(tenantMemberships.userId, authUser.id))
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .leftJoin(
      events,
      and(eq(events.tenantId, tenants.id), ...externalEventConditions(since))
    )
    .where(and(...planConditions(plan)))
    .groupBy(authUser.id)
    .orderBy(sql`MAX(${authSession.updatedAt}) DESC NULLS LAST`, desc(authUser.createdAt))
}

function FilterControls({
  timeframe,
  plan,
}: {
  timeframe: Timeframe
  plan: PlanFilter
}) {
  return (
    <form className="flex flex-wrap items-end gap-3" action="/admin">
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-foreground">Timeframe</span>
        <select
          name="timeframe"
          defaultValue={timeframe}
          className="h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
        >
          {TIMEFRAMES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-foreground">Plan</span>
        <select
          name="plan"
          defaultValue={plan}
          className="h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
        >
          {PLANS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Apply
      </button>
    </form>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{formatNumber(value)}</p>
    </div>
  )
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: AdminSearchParams
}) {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') notFound()

  const session = await getServerSession()
  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent('/admin')}`)
  }

  if (!isPlatformAdminEmail(session.user.email)) notFound()

  const rawParams = await searchParams
  const timeframe = normalizeTimeframe(rawParams.timeframe)
  const plan = normalizePlan(rawParams.plan)
  const since = sinceFor(timeframe)
  const firstTenant = await getFirstTenantForUser(session.user.id)

  const [summary, organizations, users] = await Promise.all([
    getSummaryMetrics(since, plan),
    getOrganizationRows(since, plan),
    getUserRows(since, plan),
  ])

  const content = (hasSidebar: boolean) => (
    <main
      className={`min-w-0 flex-1 overflow-y-auto bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8 ${
        hasSidebar ? 'pt-22 md:pt-8' : ''
      }`}
    >
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Platform Usage</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Grand-admin view of organizations, account activity, configured sources, and event usage.
            </p>
          </div>
          <FilterControls timeframe={timeframe} plan={plan} />
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Organizations" value={summary.totalOrganizations} />
          <MetricCard label="Paid Organizations" value={summary.paidOrganizations} />
          <MetricCard label="Active Users" value={summary.activeUsers} />
          <MetricCard label="External Events" value={summary.externalEvents} />
          <MetricCard label="Configured Sources" value={summary.configuredSources} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Organizations</h2>
            <span className="text-sm text-muted-foreground">{organizations.length} shown</span>
          </div>
          <div className="overflow-x-auto rounded-md border border-border/70 bg-card">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Sources</th>
                  <th className="px-4 py-3 font-medium">Events</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{organization.name}</p>
                      <p className="text-xs text-muted-foreground">{organization.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{organization.plan}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{organization.ownerName ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{organization.ownerEmail ?? 'No owner email'}</p>
                    </td>
                    <td className="px-4 py-3">{formatNumber(organization.memberCount)}</td>
                    <td className="px-4 py-3">{formatNumber(organization.configuredSourceCount)}</td>
                    <td className="px-4 py-3">{formatNumber(organization.eventCount)}</td>
                    <td className="px-4 py-3">{formatDateTime(organization.latestMemberActivity)}</td>
                    <td className="px-4 py-3">{formatDate(organization.createdAt)}</td>
                  </tr>
                ))}
                {organizations.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={8}>
                      No organizations match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Users</h2>
            <span className="text-sm text-muted-foreground">{users.length} shown</span>
          </div>
          <div className="overflow-x-auto rounded-md border border-border/70 bg-card">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Memberships</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.name || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="max-w-md px-4 py-3 text-muted-foreground">
                      {user.memberships ?? 'No memberships'}
                    </td>
                    <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">{formatDateTime(user.latestSessionActivity)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={isActiveInWindow(user, since) ? 'default' : 'secondary'}>
                        {isActiveInWindow(user, since) ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                      No users match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )

  if (!firstTenant) {
    return <div className="flex h-full">{content(false)}</div>
  }

  return (
    <div className="flex h-full">
      <AppSidebar slug={firstTenant.slug} />
      {content(true)}
    </div>
  )
}
