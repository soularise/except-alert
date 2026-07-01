import { NextRequest, NextResponse } from 'next/server'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { controllerJobs, tenantProviders } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { canCreateControllerJob, limitsFor } from '@/lib/plan-limits'
import { controllerJobWriteSchema, providerIdForControllerJob } from '@/lib/controller-jobs'

type Params = { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const jobs = await db
      .select()
      .from(controllerJobs)
      .where(eq(controllerJobs.tenantId, access.tenant.id))
      .orderBy(desc(controllerJobs.createdAt))

    return NextResponse.json({ jobs })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = controllerJobWriteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid controller job configuration' }, { status: 400 })
  }

  const providerId = providerIdForControllerJob(parsed.data.type, parsed.data.config)

  try {
    const [created] = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${access.tenant.id}), 4)`)

      if (providerId) {
        const [provider] = await tx
          .select({ id: tenantProviders.id })
          .from(tenantProviders)
          .where(
            and(
              eq(tenantProviders.tenantId, access.tenant.id),
              eq(tenantProviders.providerId, providerId)
            )
          )
          .limit(1)

        if (!provider) throw new ControllerJobRouteError('unknown_provider')
      }

      const [jobCount] = await tx
        .select({ value: count() })
        .from(controllerJobs)
        .where(eq(controllerJobs.tenantId, access.tenant.id))

      if (!canCreateControllerJob(access.tenant.plan, jobCount?.value ?? 0)) {
        throw new ControllerJobRouteError('controller_job_limit')
      }

      return tx
        .insert(controllerJobs)
        .values({
          tenantId: access.tenant.id,
          name: parsed.data.name,
          type: parsed.data.type,
          config: parsed.data.config,
          cronExpr: parsed.data.cronExpr,
          timezone: parsed.data.timezone,
          enabled: parsed.data.enabled,
        })
        .returning()
    })

    return NextResponse.json({ job: created }, { status: 201 })
  } catch (err) {
    return controllerJobErrorResponse(err, access.tenant.plan)
  }
}

class ControllerJobRouteError extends Error {
  constructor(public code: 'unknown_provider' | 'controller_job_limit') {
    super(code)
  }
}

function controllerJobErrorResponse(err: unknown, plan: string | null | undefined) {
  if (err instanceof ControllerJobRouteError && err.code === 'unknown_provider') {
    return NextResponse.json(
      { error: 'Controller job provider must be configured for this organization.' },
      { status: 400 }
    )
  }

  if (err instanceof ControllerJobRouteError && err.code === 'controller_job_limit') {
    const limit = limitsFor(plan).controllerJobs
    return NextResponse.json(
      { error: `Your current plan allows ${limit} controller job${limit === 1 ? '' : 's'}.` },
      { status: 403 }
    )
  }

  if (err instanceof Error && err.message.includes('controller_jobs_tenant_name_unique')) {
    return NextResponse.json(
      { error: 'A controller job with this name already exists.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
