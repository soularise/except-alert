'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function AcceptInviteClient({ token }: { token: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function acceptInvite() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, { method: 'POST' })
      const data = await res.json() as { slug?: string; error?: string }
      if (!res.ok || !data.slug) {
        throw new Error(data.error ?? 'Could not accept invitation')
      }
      router.push(`/${data.slug}/dashboard`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={acceptInvite} disabled={loading}>
        {loading ? 'Joining...' : 'Accept invitation'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
