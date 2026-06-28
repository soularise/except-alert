'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPanel } from '@/components/AuthPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SetupClient() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/setup/tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName })
    })
    const data = (await res.json()) as { slug?: string; error?: string }
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not create organization')
      return
    }
    router.push(`/${data.slug}/dashboard`)
  }

  return (
    <AuthPanel
      title="Create your Free organization"
      subtitle="This workspace owns sources, events, members, and plan limits."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name">Organization name</Label>
          <Input
            id="name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Corp"
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating...' : 'Create Free organization'}
        </Button>
      </form>
    </AuthPanel>
  )
}
