'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTenant } from '@/components/TenantProvider'
import { TelegramSetupGuide } from '@/components/TelegramSetupGuide'
import { Separator } from '@/components/ui/separator'
import { canUseChannel } from '@/lib/plan-limits'

export default function SettingsPage() {
  const { tenant, role } = useTenant()
  const [slackUrl, setSlackUrl] = useState('')
  const [slackNotifyOnEvent, setSlackNotifyOnEvent] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramNotifyOnEvent, setTelegramNotifyOnEvent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingSlack, setTestingSlack] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [telegramGuideOpen, setTelegramGuideOpen] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [slackTestMessage, setSlackTestMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [telegramTestMessage, setTelegramTestMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const canManageSettings = role === 'owner' || role === 'admin'
  const canUseSlack = canUseChannel(tenant.plan, 'slack')

  useEffect(() => {
    fetch(`/api/${tenant.slug}/settings`)
      .then((r) => r.json())
      .then((data) => {
        setSlackUrl(data.slack_webhook_url ?? '')
        setSlackNotifyOnEvent(Boolean(data.slack_notify_on_event))
        setTelegramToken(data.telegram_bot_token ?? '')
        setTelegramChatId(data.telegram_chat_id ?? '')
        setTelegramNotifyOnEvent(Boolean(data.telegram_notify_on_event))
      })
      .finally(() => setLoading(false))
  }, [tenant.slug])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMessage(null)
    setSlackTestMessage(null)
    setTelegramTestMessage(null)
    try {
      const res = await fetch(`/api/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slack_webhook_url: slackUrl,
          slack_notify_on_event: canUseSlack ? slackNotifyOnEvent : false,
          telegram_bot_token: telegramToken,
          telegram_chat_id: telegramChatId,
          telegram_notify_on_event: telegramNotifyOnEvent,
        }),
      })
      setSaveMessage(res.ok ? 'Saved.' : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSlack() {
    setTestingSlack(true)
    setSlackTestMessage(null)
    try {
      const res = await fetch(`/api/${tenant.slug}/settings/slack-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slack_webhook_url: slackUrl }),
      })
      const data = await res.json()
      setSlackTestMessage(
        res.ok
          ? { ok: true, text: 'Test message sent.' }
          : { ok: false, text: data.error ?? 'Test failed.' }
      )
    } finally {
      setTestingSlack(false)
    }
  }

  async function handleTestTelegram() {
    setTestingTelegram(true)
    setTelegramTestMessage(null)
    try {
      const res = await fetch(`/api/${tenant.slug}/settings/telegram-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_bot_token: telegramToken, telegram_chat_id: telegramChatId }),
      })
      const data = await res.json()
      setTelegramTestMessage(
        res.ok
          ? { ok: true, text: 'Test message sent.' }
          : { ok: false, text: data.error ?? 'Test failed.' }
      )
    } finally {
      setTestingTelegram(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="w-full max-w-4xl space-y-6" style={{ width: '960px', maxWidth: '100%' }}>
      <form
        onSubmit={handleSave}
        className="w-full max-w-3xl space-y-6 rounded-md border bg-card p-4"
        style={{ width: '760px', maxWidth: '100%' }}
      >
        <div>
          <h3 className="text-sm font-medium text-foreground">Notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure notification channels for baseline alerts and per-event alerts.
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slack</h4>
          {!canUseSlack && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Slack delivery requires Pro or Growth. Dashboard and Telegram remain available on Free.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="slack-url">Webhook URL</Label>
            <Input
              id="slack-url"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              disabled={!canManageSettings || !canUseSlack}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-background"
                checked={canUseSlack && slackNotifyOnEvent}
                onChange={(e) => setSlackNotifyOnEvent(e.target.checked)}
                disabled={!canManageSettings || !canUseSlack}
              />
              Notify Slack for every new event
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testingSlack || !slackUrl.trim() || !canManageSettings || !canUseSlack}
              onClick={handleTestSlack}
            >
              {testingSlack ? 'Sending...' : 'Send Test'}
            </Button>
            {slackTestMessage && (
              <p className={`text-sm ${slackTestMessage.ok ? 'text-green-600' : 'text-destructive'}`}>
                {slackTestMessage.text}
              </p>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Telegram</h4>
            {canManageSettings && (
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => setTelegramGuideOpen(true)}
              >
                Setup guide
              </button>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="telegram-token">Bot Token</Label>
            <Input
              id="telegram-token"
              type="password"
              placeholder="123456789:ABC..."
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              disabled={!canManageSettings}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telegram-chat-id">Chat ID</Label>
            <Input
              id="telegram-chat-id"
              placeholder="-100123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              disabled={!canManageSettings}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-background"
                checked={telegramNotifyOnEvent}
                onChange={(e) => setTelegramNotifyOnEvent(e.target.checked)}
                disabled={!canManageSettings}
              />
              Notify Telegram for every new event
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testingTelegram || !telegramToken.trim() || !telegramChatId.trim() || !canManageSettings}
              onClick={handleTestTelegram}
            >
              {testingTelegram ? 'Sending...' : 'Send Test'}
            </Button>
            {telegramTestMessage && (
              <p className={`text-sm ${telegramTestMessage.ok ? 'text-green-600' : 'text-destructive'}`}>
                {telegramTestMessage.text}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <Button type="submit" disabled={saving || !canManageSettings}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {saveMessage && (
            <p className="text-sm text-muted-foreground">{saveMessage}</p>
          )}
        </div>
        {!canManageSettings && (
          <p className="text-sm text-muted-foreground">
            Ask an admin or owner to change notification settings.
          </p>
        )}
      </form>
      <TelegramSetupGuide
        open={telegramGuideOpen}
        onOpenChange={setTelegramGuideOpen}
        onComplete={(token, chatId) => {
          setTelegramToken(token)
          setTelegramChatId(chatId)
        }}
      />
    </div>
  )
}
