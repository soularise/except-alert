'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTenant } from '@/components/TenantProvider'
import { AccountSettings } from '@/components/AccountSettings'

export default function SettingsPage() {
  const { tenant, role, authDisabled } = useTenant()
  const [slackUrl, setSlackUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const canManageSettings = role === 'owner' || role === 'admin'

  useEffect(() => {
    fetch(`/api/${tenant.slug}/settings`)
      .then((r) => r.json())
      .then((data) => setSlackUrl(data.slack_webhook_url ?? ''))
      .finally(() => setLoading(false))
  }, [tenant.slug])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMessage(null)
    setTestMessage(null)
    try {
      const res = await fetch(`/api/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slack_webhook_url: slackUrl }),
      })
      setSaveMessage(res.ok ? 'Saved.' : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestMessage(null)
    try {
      const res = await fetch(`/api/${tenant.slug}/settings/slack-test`, { method: 'POST' })
      const data = await res.json()
      setTestMessage(
        res.ok
          ? { ok: true, text: 'Test message sent.' }
          : { ok: false, text: data.error ?? 'Test failed.' }
      )
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="w-full max-w-4xl space-y-6" style={{ width: '960px', maxWidth: '100%' }}>
      <form
        onSubmit={handleSave}
        className="w-full max-w-3xl space-y-4 rounded-md border bg-card p-4"
        style={{ width: '760px', maxWidth: '100%' }}
      >
        <div>
          <h3 className="text-sm font-medium text-foreground">Notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure tenant-level Slack delivery for alert notifications.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="slack-url">Slack webhook URL</Label>
          <Input
            id="slack-url"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            disabled={!canManageSettings}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || !canManageSettings}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testing || !slackUrl.trim() || !canManageSettings}
            onClick={handleTest}
          >
            {testing ? 'Sending...' : 'Send Test Message'}
          </Button>
          {saveMessage && (
            <p className="text-sm text-muted-foreground">{saveMessage}</p>
          )}
        </div>
        {testMessage && (
          <p className={`text-sm ${testMessage.ok ? 'text-green-600' : 'text-destructive'}`}>
            {testMessage.text}
          </p>
        )}
        {!canManageSettings && (
          <p className="text-sm text-muted-foreground">
            Ask an admin or owner to change Slack settings.
          </p>
        )}
      </form>
      <AccountSettings authDisabled={authDisabled} />
    </div>
  )
}
