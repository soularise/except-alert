'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthPanel } from '@/components/AuthPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  return (
    <AuthPanel title="Set new password" subtitle="Choose a new password for your account.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthPanel>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!token) {
        throw new Error('This reset link is missing a token.')
      }
      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match.')
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      })

      if (!res.ok) {
        throw new Error(await readAuthError(res, 'Reset link is invalid or expired.'))
      }

      router.push('/login?reset=success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          This reset link is missing a token. Request a new reset link to continue.
        </p>
        <Button type="button" className="w-full" onClick={() => router.push('/forgot-password')}>
          Request reset link
        </Button>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Updating...' : 'Update password'}
        </Button>
      </form>
      <p className="mt-6 border-t border-border/60 pt-4 text-sm text-muted-foreground">
        Back to{' '}
        <Link href="/login" className="text-primary hover:underline">
          sign in
        </Link>
      </p>
    </>
  )
}

async function readAuthError(res: Response, fallback: string) {
  try {
    const data = await res.json() as { message?: string; error?: string; code?: string }
    return data.message ?? data.error ?? data.code ?? fallback
  } catch {
    return fallback
  }
}
