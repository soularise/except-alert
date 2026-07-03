import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings, tenants } from '@/lib/db/schema'
import { canUseChannel } from '@/lib/plan-limits'
import { sendSlackAlert } from '@/lib/slack'
import { sendTeamsAlert } from '@/lib/teams'
import { sendTelegramAlert } from '@/lib/telegram'

const ALERT_SETTING_KEYS = [
  'slack_webhook_url',
  'teams_webhook_url',
  'telegram_bot_token',
  'telegram_chat_id',
] as const

export type AlertNotificationResult = {
  attempted: string[]
  delivered: string[]
  failed: { channel: string; message: string }[]
  skipped: string[]
}

export async function sendTenantAlertNotifications(
  tenantId: string,
  message: string
): Promise<AlertNotificationResult> {
  const result: AlertNotificationResult = {
    attempted: [],
    delivered: [],
    failed: [],
    skipped: [],
  }

  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    result.skipped.push('tenant_missing')
    return result
  }

  const rows = await db
    .select()
    .from(settings)
    .where(
      and(
        eq(settings.tenantId, tenantId),
        inArray(settings.key, [...ALERT_SETTING_KEYS])
      )
    )

  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  const slackUrl = values['slack_webhook_url'] ?? null
  const teamsUrl = values['teams_webhook_url'] ?? null
  const telegramToken = values['telegram_bot_token'] ?? null
  const telegramChatId = values['telegram_chat_id'] ?? null

  if (slackUrl && canUseChannel(tenant.plan, 'slack')) {
    result.attempted.push('slack')
    try {
      await sendSlackAlert(slackUrl, message)
      result.delivered.push('slack')
    } catch (err) {
      result.failed.push({
        channel: 'slack',
        message: err instanceof Error ? err.message : 'Unknown Slack delivery error',
      })
    }
  } else if (slackUrl) {
    result.skipped.push('slack_plan_blocked')
  } else {
    result.skipped.push('slack_not_configured')
  }

  if (teamsUrl && canUseChannel(tenant.plan, 'teams')) {
    result.attempted.push('teams')
    try {
      await sendTeamsAlert(teamsUrl, message)
      result.delivered.push('teams')
    } catch (err) {
      result.failed.push({
        channel: 'teams',
        message: err instanceof Error ? err.message : 'Unknown Teams delivery error',
      })
    }
  } else if (teamsUrl) {
    result.skipped.push('teams_plan_blocked')
  } else {
    result.skipped.push('teams_not_configured')
  }

  if (telegramToken && telegramChatId && canUseChannel(tenant.plan, 'telegram')) {
    result.attempted.push('telegram')
    try {
      await sendTelegramAlert(telegramToken, telegramChatId, message)
      result.delivered.push('telegram')
    } catch (err) {
      result.failed.push({
        channel: 'telegram',
        message: err instanceof Error ? err.message : 'Unknown Telegram delivery error',
      })
    }
  } else if (telegramToken || telegramChatId) {
    result.skipped.push('telegram_incomplete')
  } else {
    result.skipped.push('telegram_not_configured')
  }

  return result
}
