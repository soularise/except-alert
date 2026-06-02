import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { actionTemplates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
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

  const { category, label, url, method, headers, payload_template } = body as {
    category?: unknown
    label?: unknown
    url?: unknown
    method?: unknown
    headers?: unknown
    payload_template?: unknown
  }

  try {
    const [existing] = await db
      .select()
      .from(actionTemplates)
      .where(eq(actionTemplates.id, id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}

    if (typeof category === 'string') updates.category = category
    if (typeof label === 'string') updates.label = label

    const existingConfig = existing.config as {
      url: string
      method: string
      headers: unknown
      payload_template: unknown
    }

    const hasConfigUpdate = url !== undefined || method !== undefined || headers !== undefined || payload_template !== undefined
    if (hasConfigUpdate) {
      updates.config = {
        url: typeof url === 'string' ? url : existingConfig.url,
        method: typeof method === 'string' ? method : existingConfig.method,
        headers: headers !== undefined ? headers : existingConfig.headers,
        payload_template: payload_template !== undefined ? payload_template : existingConfig.payload_template,
      }
    }

    const [updated] = await db
      .update(actionTemplates)
      .set(updates)
      .where(eq(actionTemplates.id, id))
      .returning()

    return NextResponse.json({ template: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const [deleted] = await db
      .delete(actionTemplates)
      .where(eq(actionTemplates.id, id))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
