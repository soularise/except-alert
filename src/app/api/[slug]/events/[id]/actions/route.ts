import { NextRequest, NextResponse } from 'next/server'
import { requireTenantAccess } from '@/lib/auth-guard'
import { executeAction } from '@/lib/hitl'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'member')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { templateId } = body as { templateId?: unknown }
  if (typeof templateId !== 'string' || !templateId.trim()) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  try {
    const result = await executeAction(access.tenant.id, id, templateId)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 422 })
    }

    return NextResponse.json(
      {
        success: true,
        alreadyExecuted: result.alreadyExecuted,
        actionId: result.actionId,
      },
      { status: result.alreadyExecuted ? 200 : 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = message.endsWith('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
