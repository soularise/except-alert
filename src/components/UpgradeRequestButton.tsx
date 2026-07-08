'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type UpgradeRequestButtonProps = {
  slug: string
  source: string
  prompt: string
  buttonLabel?: string
  requestedPlan?: 'pro' | 'growth'
}

export function UpgradeRequestButton({
  slug,
  source,
  prompt,
  buttonLabel = 'Request upgrade',
  requestedPlan = 'pro',
}: UpgradeRequestButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submitRequest() {
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/${slug}/upgrade-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedPlan,
          source,
          reason: reason.trim() || prompt,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not submit upgrade request.')

      setOpen(false)
      setReason('')
      setMessage('Upgrade request sent. We will follow up with payment details.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit upgrade request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {open ? (
        <div className="space-y-2 rounded-md border border-border/70 bg-background p-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Upgrade note</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="min-h-20 rounded-md border border-input bg-input/25 px-3 py-2 text-sm"
              placeholder={prompt}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={submitRequest} disabled={loading}>
              {loading ? 'Sending...' : 'Send request'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          {buttonLabel}
        </Button>
      )}
      {message && <p className="text-sm text-primary">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
