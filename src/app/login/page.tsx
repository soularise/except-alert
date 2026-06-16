'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await authClient.signIn.email({
      email,
      password
    })
    setLoading(false)

    if (authError) {
      setError(authError.message ?? 'Invalid email or password')
      return
    }

    router.push(returnTo ?? '/')
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 border-t border-border/60 pt-4 text-sm text-muted-foreground">
        No account?{' '}
        <Link href="/signup" className="text-primary hover:underline">
          Sign up
        </Link>
      </p>
      {searchParams.get('reset') === 'success' && (
        <p className="mt-4 text-sm text-green-600">
          Password updated. Sign in with your new password.
        </p>
      )}
    </>
  )
}
