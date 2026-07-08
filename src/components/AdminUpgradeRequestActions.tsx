'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type AdminUpgradeRequestActionsProps = {
  requestId: string
  status: string
}

export function AdminUpgradeRequestActions({
  requestId,
  status,
}: AdminUpgradeRequestActionsProps) {
  const router = useRouter()
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(nextStatus: string) {
    setLoadingStatus(nextStatus)
    setError(null)

    try {
      const res = await fetch(`/api/admin/upgrade-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not update request.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update request.')
    } finally {
      setLoadingStatus(null)
    }
  }

  const disabled = Boolean(loadingStatus) || status === 'approved' || status === 'declined'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status === 'open' && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() => updateStatus('payment_sent')}
          >
            {loadingStatus === 'payment_sent' ? 'Updating...' : 'Payment sent'}
          </Button>
        )}
        {(status === 'open' || status === 'payment_sent') && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() => updateStatus('paid')}
          >
            {loadingStatus === 'paid' ? 'Updating...' : 'Mark paid'}
          </Button>
        )}
        {status === 'paid' && (
          <Button
            type="button"
            size="xs"
            disabled={disabled}
            onClick={() => updateStatus('approved')}
          >
            {loadingStatus === 'approved' ? 'Approving...' : 'Approve'}
          </Button>
        )}
        {(status === 'open' || status === 'payment_sent' || status === 'paid') && (
          <Button
            type="button"
            size="xs"
            variant="destructive"
            disabled={disabled}
            onClick={() => updateStatus('declined')}
          >
            {loadingStatus === 'declined' ? 'Declining...' : 'Decline'}
          </Button>
        )}
      </div>
      {error && <p className="text-right text-xs text-destructive">{error}</p>}
    </div>
  )
}
