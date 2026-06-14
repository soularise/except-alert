import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { sendTelegramAlert } from '@/lib/telegram'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    let botToken: string | null = null
    let chatId: string | null = null

    const body = await request.json().catch(() => ({}))
    if (
      typeof body?.telegram_bot_token === 'string' && body.telegram_bot_token.trim() &&
      typeof body?.telegram_chat_id === 'string' && body.telegram_chat_id.trim()
    ) {
      botToken = body.telegram_bot_token.trim()
      chatId = body.telegram_chat_id.trim()
    } else {
      const rows = await db
        .select()
        .from(settings)
        .where(
          and(
            eq(settings.tenantId, access.tenant.id),
            inArray(settings.key, ['telegram_bot_token', 'telegram_chat_id'])
          )
        )
      const values = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      botToken = values['telegram_bot_token'] ?? null
      chatId = values['telegram_chat_id'] ?? null
    }

    if (!botToken || !chatId) {
      return NextResponse.json(
        { error: 'Telegram bot token and chat ID must both be configured' },
        { status: 400 }
      )
    }

    await sendTelegramAlert(botToken, chatId, 'ExceptAlert: Test message. Telegram alerts are working.')
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
