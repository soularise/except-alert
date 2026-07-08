import { sendTelegramAlert } from '@/lib/telegram'

type UpgradeRequestNotification = {
  organizationName: string
  organizationSlug: string
  requesterName: string
  requesterEmail: string
  currentPlan: string
  requestedPlan: string
  source: string
  reason: string | null
}

export async function notifyPlatformUpgradeRequest(input: UpgradeRequestNotification) {
  const botToken = process.env.EXCEPTALERT_ADMIN_TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.EXCEPTALERT_ADMIN_TELEGRAM_CHAT_ID?.trim()
  if (!botToken || !chatId) return { skipped: true, reason: 'telegram_not_configured' as const }

  const appUrl =
    process.env.EXCEPTALERT_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    'http://localhost:3000'

  const reason = input.reason?.trim()
    ? `\nReason: ${input.reason.trim()}`
    : ''

  await sendTelegramAlert(
    botToken,
    chatId,
    [
      'ExceptAlert upgrade request',
      `Organization: ${input.organizationName} (${input.organizationSlug})`,
      `Requester: ${input.requesterName} <${input.requesterEmail}>`,
      `Plan: ${input.currentPlan} -> ${input.requestedPlan}`,
      `Source: ${input.source}`,
      `${appUrl.replace(/\/$/, '')}/admin`,
      reason,
    ].filter(Boolean).join('\n')
  )

  return { skipped: false as const }
}
