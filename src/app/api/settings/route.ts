import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'

export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'slack_webhook_url'))
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
    await db
      .insert(settings)
      .values({ key: 'slack_webhook_url', value: slack_webhook_url })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: slack_webhook_url, updatedAt: new Date() },
      })
    return NextResponse.json({ slack_webhook_url })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
