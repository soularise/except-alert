import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { ZodError } from 'zod'
import { db } from '@/lib/db'
import { controllerJobs, tenantProviders } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { controllerJobWriteSchema, providerIdForControllerJob } from '@/lib/controller-jobs'

type Params = { params: Promise<{ slug: string; id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [job] = await db
      .select()
      .from(controllerJobs)
      .where(and(eq(controllerJobs.id, id), eq(controllerJobs.tenantId, access.tenant.id)))
      .limit(1)

    if (!job) return NextResponse.json({ error: 'Controller job not found' }, { status: 404 })
    return NextResponse.json({ job })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const [existing] = await db
      .select()
      .from(controllerJobs)
      .where(and(eq(controllerJobs.id, id), eq(controllerJobs.tenantId, access.tenant.id)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Controller job not found' }, { status: 404 })
    }

    const updates = body as Partial<{
      name: unknown
      type: unknown
      config: unknown
      cronExpr: unknown
      timezone: unknown
      enabled: unknown
    }>

    const candidate = controllerJobWriteSchema.parse({
      name: updates.name ?? existing.name,
      type: updates.type ?? existing.type,
      config: updates.config ?? existing.config,
      cronExpr: updates.cronExpr ?? existing.cronExpr,
      timezone: updates.timezone ?? existing.timezone,
      enabled: updates.enabled ?? existing.enabled,
    })

    const providerId = providerIdForControllerJob(candidate.type, candidate.config)
    if (providerId) {
      const [provider] = await db
        .select({ id: tenantProviders.id })
        .from(tenantProviders)
        .where(
          and(
            eq(tenantProviders.tenantId, access.tenant.id),
            eq(tenantProviders.providerId, providerId)
          )
        )
        .limit(1)

      if (!provider) {
        return NextResponse.json(
          { error: 'Controller job provider must be configured for this organization.' },
          { status: 400 }
        )
      }
    }

    const [updated] = await db
      .update(controllerJobs)
      .set({
        name: candidate.name,
        type: candidate.type,
        config: candidate.config,
        cronExpr: candidate.cronExpr,
        timezone: candidate.timezone,
        enabled: candidate.enabled,
        updatedAt: new Date(),
      })
      .where(and(eq(controllerJobs.id, id), eq(controllerJobs.tenantId, access.tenant.id)))
      .returning()

    return NextResponse.json({ job: updated })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid controller job configuration' }, { status: 400 })
    }
    if (err instanceof Error && err.message.includes('controller_jobs_tenant_name_unique')) {
      return NextResponse.json(
        { error: 'A controller job with this name already exists.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [deleted] = await db
      .delete(controllerJobs)
      .where(and(eq(controllerJobs.id, id), eq(controllerJobs.tenantId, access.tenant.id)))
      .returning()

    if (!deleted) return NextResponse.json({ error: 'Controller job not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
