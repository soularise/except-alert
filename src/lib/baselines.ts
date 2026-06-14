import { and, count, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { baselines, events, settings } from '@/lib/db/schema'
import { sendSlackAlert } from '@/lib/slack'
import { sendTelegramAlert } from '@/lib/telegram'

export async function evaluateBaselines(tenantId: string): Promise<void> {
  const allBaselines = await db
    .select()
    .from(baselines)
    .where(eq(baselines.tenantId, tenantId))
  if (allBaselines.length === 0) return

  const settingRows = await db
    .select()
    .from(settings)
    .where(
      and(
        eq(settings.tenantId, tenantId),
        inArray(settings.key, ['slack_webhook_url', 'telegram_bot_token', 'telegram_chat_id'])
      )
    )
  const settingValues = Object.fromEntries(settingRows.map((r) => [r.key, r.value]))
  const slackUrl = settingValues['slack_webhook_url'] ?? null
  const telegramToken = settingValues['telegram_bot_token'] ?? null
  const telegramChatId = settingValues['telegram_chat_id'] ?? null

  const now = new Date()

  for (const baseline of allBaselines) {
    if (baseline.lastAlertedAt) {
      const cooldownExpiry = new Date(
        baseline.lastAlertedAt.getTime() + baseline.windowMinutes * 60_000
      )
      if (now < cooldownExpiry) continue
    }

    const windowStart = new Date(now.getTime() - baseline.windowMinutes * 60_000)
    const [result] = await db
      .select({ value: count() })
      .from(events)
      .where(
        and(
          eq(events.tenantId, tenantId),
          eq(events.category, baseline.category),
          gte(events.receivedAt, windowStart)
        )
      )

    const eventCount = result?.value ?? 0
    if (eventCount <= baseline.threshold) continue

    const message = [
      '🚨 ExceptAlert — Baseline breached',
      `Category: ${baseline.category}`,
      `Threshold: ${baseline.threshold} events / ${baseline.windowMinutes} min`,
      `Actual: ${eventCount} events in the last ${baseline.windowMinutes} min`,
    ].join('\n')

    let anyFailed = false

    if (slackUrl) {
      try {
        await sendSlackAlert(slackUrl, message)
      } catch (err) {
        console.error('[baselines] Slack delivery failed:', err)
        anyFailed = true
      }
    }

    if (telegramToken && telegramChatId) {
      try {
        await sendTelegramAlert(telegramToken, telegramChatId, message)
      } catch (err) {
        console.error('[baselines] Telegram delivery failed:', err)
        anyFailed = true
      }
    }

    if (anyFailed) continue

    await db
      .update(baselines)
      .set({ lastAlertedAt: now })
      .where(and(eq(baselines.id, baseline.id), eq(baselines.tenantId, tenantId)))
  }
}
