import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { sendSlackAlert } from '@/lib/slack'

export async function POST() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'slack_webhook_url'))
      .limit(1)

    if (!row?.value) {
      return NextResponse.json({ error: 'No Slack webhook URL configured' }, { status: 400 })
    }

    await sendSlackAlert(
      row.value,
      '✅ *ExceptAlert* — Test message. Slack alerts are working.'
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
