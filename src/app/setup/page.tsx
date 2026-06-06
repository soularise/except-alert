'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SetupPage() {
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
      body: JSON.stringify({ name: orgName }),
    })
    const data = await res.json() as { slug?: string; error?: string }
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    router.push(`/${data.slug}/dashboard`)
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Create your organization</h1>
          <p className="mt-1 text-sm text-zinc-400">
            You&apos;re signed in but have no organization yet.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Organization name</Label>
            <Input
              id="name"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create organization'}
          </Button>
        </form>
      </div>
    </div>
  )
}
