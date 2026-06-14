import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'

const NOTIFICATION_KEYS = ['slack_webhook_url', 'telegram_bot_token', 'telegram_chat_id'] as const
type NotificationKey = (typeof NOTIFICATION_KEYS)[number]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.tenantId, access.tenant.id),
          inArray(settings.key, [...NOTIFICATION_KEYS])
        )
      )
    const values = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return NextResponse.json({
      slack_webhook_url: values['slack_webhook_url'] ?? null,
      telegram_bot_token: values['telegram_bot_token'] ?? null,
      telegram_chat_id: values['telegram_chat_id'] ?? null,
    })
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

  const updates: { key: NotificationKey; value: string }[] = []
  for (const key of NOTIFICATION_KEYS) {
    const val = (body as Record<string, unknown>)[key]
    if (typeof val === 'string') {
      updates.push({ key, value: val.trim() })
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  try {
    for (const { key, value } of updates) {
      await db
        .insert(settings)
        .values({ tenantId: access.tenant.id, key, value })
        .onConflictDoUpdate({
          target: [settings.tenantId, settings.key],
          set: { value, updatedAt: new Date() },
        })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
