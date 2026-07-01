import { NextRequest, NextResponse } from 'next/server'
import { runControllerJobNow } from '@/lib/controller'
import { requireTenantAccess } from '@/lib/auth-guard'

type Params = { params: Promise<{ slug: string; id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const run = await runControllerJobNow(access.tenant.id, id)
    if (!run.claimed) {
      return NextResponse.json(
        { error: 'Controller job is not available to run.' },
        { status: 409 }
      )
    }

    if (!run.evaluated) {
      return NextResponse.json(
        { error: 'Controller job could not record its result.', result: run.result },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, result: run.result })
  } catch (err) {
    console.error('[controller] manual trigger failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
