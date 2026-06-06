import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'

export async function GET() {
  // TODO(auth): replace with session tenant once auth is wired
  const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.tenantId, DEFAULT_TENANT_ID), eq(settings.key, 'slack_webhook_url')))
      .limit(1)
    return NextResponse.json({ slack_webhook_url: row?.value ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slack_webhook_url } = body as { slack_webhook_url?: unknown }

  if (typeof slack_webhook_url !== 'string' || !slack_webhook_url.trim()) {
    return NextResponse.json({ error: 'slack_webhook_url is required' }, { status: 400 })
  }

  try {
    // TODO(auth): replace with session tenant once auth is wired
    const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
    await db
      .insert(settings)
      .values({ tenantId: DEFAULT_TENANT_ID, key: 'slack_webhook_url', value: slack_webhook_url })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: slack_webhook_url, updatedAt: new Date() },
      })
    return NextResponse.json({ slack_webhook_url })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
