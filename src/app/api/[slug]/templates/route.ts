import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { actionTemplates } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const templates = await db
      .select()
      .from(actionTemplates)
      .where(eq(actionTemplates.tenantId, access.tenant.id))
      .orderBy(desc(actionTemplates.createdAt))
    return NextResponse.json({ templates })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
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

  if (typeof category !== 'string' || !category.trim()) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }
  if (typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }
  if (typeof url !== 'string' || !url.trim()) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  if (typeof method !== 'string' || !method.trim()) {
    return NextResponse.json({ error: 'method is required' }, { status: 400 })
  }

  try {
    const [created] = await db
      .insert(actionTemplates)
      .values({
        tenantId: access.tenant.id,
        category: category.trim(),
        label: label.trim(),
        config: {
          url: url.trim(),
          method,
          headers: headers ?? null,
          payload_template: payload_template ?? null,
        },
      })
      .returning()
    return NextResponse.json({ template: created }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
