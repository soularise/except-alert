import { and, count, eq, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { baselines, events, settings } from '@/lib/db/schema'
import { sendSlackAlert } from '@/lib/slack'

export async function evaluateBaselines(): Promise<void> {
  const allBaselines = await db.select().from(baselines)
  if (allBaselines.length === 0) return

  const [slackSetting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'slack_webhook_url'))
    .limit(1)
  const slackUrl = slackSetting?.value ?? null

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
          eq(events.category, baseline.category),
          gte(events.receivedAt, windowStart)
        )
      )

    const eventCount = result?.value ?? 0
    if (eventCount <= baseline.threshold) continue

    if (slackUrl) {
      const message = [
        '🚨 *ExceptAlert — Baseline breached*',
        `*Category:* ${baseline.category}`,
        `*Threshold:* ${baseline.threshold} events / ${baseline.windowMinutes} min`,
        `*Actual:* ${eventCount} events in the last ${baseline.windowMinutes} min`,
      ].join('\n')

      try {
        await sendSlackAlert(slackUrl, message)
      } catch (err) {
        console.error('[baselines] Slack delivery failed:', err)
        continue
      }
    }

    await db
      .update(baselines)
      .set({ lastAlertedAt: now })
      .where(eq(baselines.id, baseline.id))
  }
}
