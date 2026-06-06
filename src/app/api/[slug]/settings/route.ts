import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.tenantId, access.tenant.id), eq(settings.key, 'slack_webhook_url')))
      .limit(1)
    return NextResponse.json({ slack_webhook_url: row?.value ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slack_webhook_url } = body as { slack_webhook_url?: unknown }
  if (typeof slack_webhook_url !== 'string') {
    return NextResponse.json({ error: 'slack_webhook_url is required' }, { status: 400 })
  }

  try {
    await db
      .insert(settings)
      .values({
        tenantId: access.tenant.id,
        key: 'slack_webhook_url',
        value: slack_webhook_url.trim(),
      })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: slack_webhook_url.trim(), updatedAt: new Date() },
      })
    return NextResponse.json({ slack_webhook_url: slack_webhook_url.trim() })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
