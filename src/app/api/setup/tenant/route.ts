import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  createSelfServeFreeOrganization,
  OrganizationLifecycleError,
} from '@/lib/organization-lifecycle'
import { isPlatformAdminEmail } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name } = body as { name?: unknown }
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    const plan = isPlatformAdminEmail(session.user.email) ? 'growth' : 'free'
    const tenant = await createSelfServeFreeOrganization(session.user.id, name.trim(), plan)
    return NextResponse.json({ slug: tenant.slug })
  } catch (err) {
    if (err instanceof OrganizationLifecycleError) {
      const status = err.code === 'self_serve_organization_exists' ? 409 : 400
      return NextResponse.json({ error: err.message }, { status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
