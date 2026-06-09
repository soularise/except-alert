'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Message = { ok: boolean; text: string } | null

async function readAuthError(res: Response, fallback: string) {
  try {
    const data = await res.json() as { message?: string; error?: string; code?: string }
    return data.message ?? data.error ?? data.code ?? fallback
  } catch {
    return fallback
  }
}

export function AccountSettings({ authDisabled }: { authDisabled?: boolean }) {
  const { data: session, isPending, refetch } = authClient.useSession()
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [profileMessage, setProfileMessage] = useState<Message>(null)
  const [passwordMessage, setPasswordMessage] = useState<Message>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  if (authDisabled) {
    return (
      <section
        className="w-full space-y-2 rounded-md border bg-card p-4"
        style={{ width: '760px', maxWidth: '100%' }}
      >
        <h3 className="text-sm font-medium text-foreground">Account</h3>
        <p className="text-sm text-muted-foreground">
          Account editing is unavailable while local auth is disabled.
        </p>
      </section>
    )
  }

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading account...</p>
  }

  if (!session?.user) {
    return (
      <section
        className="w-full space-y-2 rounded-md border bg-card p-4"
        style={{ width: '760px', maxWidth: '100%' }}
      >
        <h3 className="text-sm font-medium text-foreground">Account</h3>
        <p className="text-sm text-muted-foreground">Sign in to manage your account.</p>
      </section>
    )
  }

  const name = nameDraft ?? session.user.name

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMessage(null)
    try {
      const res = await fetch('/api/auth/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        throw new Error(await readAuthError(res, 'Failed to update profile.'))
      }
      await refetch()
      setNameDraft(null)
      setProfileMessage({ ok: true, text: 'Profile updated.' })
    } catch (err) {
      setProfileMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault()
    setSavingPassword(true)
    setPasswordMessage(null)
    try {
      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match.')
      }
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
      })
      if (!res.ok) {
        throw new Error(await readAuthError(res, 'Failed to update password.'))
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage({ ok: true, text: 'Password updated.' })
    } catch (err) {
      setPasswordMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to update password.',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <section
      className="w-full space-y-5 rounded-md border bg-card p-4"
      style={{ width: '760px', maxWidth: '100%' }}
    >
      <div>
        <h3 className="text-sm font-medium text-foreground">Account</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {session.user.email}.
        </p>
      </div>

      <form onSubmit={updateProfile} className="max-w-xl space-y-3">
        <div className="space-y-2">
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setNameDraft(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={savingProfile || !name.trim()}>
            {savingProfile ? 'Saving...' : 'Save profile'}
          </Button>
          {profileMessage && (
            <p className={`text-sm ${profileMessage.ok ? 'text-green-600' : 'text-destructive'}`}>
              {profileMessage.text}
            </p>
          )}
        </div>
      </form>

      <form onSubmit={updatePassword} className="grid max-w-xl gap-3 border-t pt-5">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? 'Updating...' : 'Update password'}
          </Button>
          {passwordMessage && (
            <p className={`text-sm ${passwordMessage.ok ? 'text-green-600' : 'text-destructive'}`}>
              {passwordMessage.text}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
