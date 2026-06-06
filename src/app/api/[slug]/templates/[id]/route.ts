import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { actionTemplates } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'

export async function PATCH(
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
      .where(and(eq(actionTemplates.id, id), eq(actionTemplates.tenantId, access.tenant.id)))
      .limit(1)

    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const updates: Partial<typeof actionTemplates.$inferInsert> = {}
    if (typeof category === 'string') updates.category = category.trim()
    if (typeof label === 'string') updates.label = label.trim()

    const existingConfig = existing.config as {
      url: string
      method: string
      headers: unknown
      payload_template: unknown
    }

    const hasConfigUpdate =
      url !== undefined || method !== undefined || headers !== undefined || payload_template !== undefined
    if (hasConfigUpdate) {
      updates.config = {
        url: typeof url === 'string' ? url.trim() : existingConfig.url,
        method: typeof method === 'string' ? method : existingConfig.method,
        headers: headers !== undefined ? headers : existingConfig.headers,
        payload_template: payload_template !== undefined ? payload_template : existingConfig.payload_template,
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const [updated] = await db
      .update(actionTemplates)
      .set(updates)
      .where(and(eq(actionTemplates.id, id), eq(actionTemplates.tenantId, access.tenant.id)))
      .returning()

    return NextResponse.json({ template: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const access = await requireTenantAccess(request, slug, 'member')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [deleted] = await db
      .delete(actionTemplates)
      .where(and(eq(actionTemplates.id, id), eq(actionTemplates.tenantId, access.tenant.id)))
      .returning()

    if (!deleted) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
