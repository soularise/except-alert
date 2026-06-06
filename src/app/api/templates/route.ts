import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { actionTemplates } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  try {
    const templates = await db
      .select()
      .from(actionTemplates)
      .orderBy(desc(actionTemplates.createdAt))

    return NextResponse.json({ templates })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

  const config = {
    url,
    method,
    headers: headers ?? null,
    payload_template: payload_template ?? null,
  }

  try {
    // TODO(auth): replace with session tenant once auth is wired
    const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
    const [created] = await db
      .insert(actionTemplates)
      .values({ tenantId: DEFAULT_TENANT_ID, category, label, config })
      .returning()

    return NextResponse.json({ template: created }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
