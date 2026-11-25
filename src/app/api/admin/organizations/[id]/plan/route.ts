import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin'
import { changeOrganizationPlan } from '@/lib/organization-lifecycle'

const planChangeSchema = z.object({
  plan: z.enum(['free', 'pro', 'growth']),
  note: z.string().trim().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getAdminSession(request.headers)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = planChangeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const note = parsed.data.note?.slice(0, 200)

  try {
    const updated = await changeOrganizationPlan({
      tenantId: id,
      nextPlan: parsed.data.plan,
      actorUserId: session.user.id,
      reason: note ? `admin_plan_change: ${note}` : 'admin_plan_change',
    })

    if (!updated) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    return NextResponse.json({ organization: { id: updated.id, plan: updated.plan } })
  } catch (err) {
    console.error('[admin plan change] failed to change plan:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
