'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { AuthPanel } from '@/components/AuthPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  return (
    <AuthPanel title="Sign in" subtitle="Monitor exceptions and handoffs.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthPanel>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password
      })

      if (authError) {
        setError(authError.message ?? 'Invalid email or password')
        return
      }

      window.location.assign(returnTo ?? '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
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
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" className="w-full" disabled={loading} onClick={handleSubmit}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      {searchParams.get('signup') === 'disabled' && (
        <p className="mt-6 border-t border-border/60 pt-4 text-sm text-muted-foreground">
          Accounts are provisioned by an ExceptAlert admin after subscription.
        </p>
      )}
      {searchParams.get('reset') === 'success' && (
        <p className="mt-4 text-sm text-green-600">
          Password updated. Sign in with your new password.
        </p>
      )}
      <p className="mt-6 border-t border-border/60 pt-4 text-sm text-muted-foreground">
        New here?{' '}
        <Link
          href={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'}
          className="text-primary hover:underline"
        >
          Start Free
        </Link>
      </p>
    </>
  )
}

function getSafeReturnTo(value: string | null) {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  return value
}
