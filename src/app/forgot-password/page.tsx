'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { AuthPanel } from '@/components/AuthPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const successMessage =
  'If that account exists, we will prepare a reset link for manual delivery.'

export default function ForgotPasswordPage() {
  return (
    <AuthPanel
      title="Reset password"
      subtitle="Request a one-use reset link from the beta operator."
    >
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthPanel>
  )
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirectTo: '/reset-password',
        }),
      })
    } finally {
      setLoading(false)
      setMessage(successMessage)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Preparing...' : 'Request reset link'}
        </Button>
      </form>
      <p className="mt-6 border-t border-border/60 pt-4 text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
