import { NextRequest, NextResponse } from 'next/server'
import { executeAction } from '@/lib/hitl'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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
    const result = await executeAction(id, templateId)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 422 })
    }

    if (result.alreadyExecuted) {
      return NextResponse.json(
        { success: true, alreadyExecuted: true, actionId: result.actionId },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: true, alreadyExecuted: false, actionId: result.actionId },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
