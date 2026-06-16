'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Clipboard, ExternalLink, KeyRound, RotateCcw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type ProvisionResult = {
  email: string
  name: string
  organizationName: string
  slug: string
  loginUrl: string
  tempPassword: string
}

function defaultOrganizationName(name: string) {
  const trimmed = name.trim()
  return trimmed ? `${trimmed}'s Org` : ''
}

interface ProvisionClientProps {
  adminTenantSlug: string | null
}

export function ProvisionClient({ adminTenantSlug }: ProvisionClientProps) {
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [slugOverride, setSlugOverride] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProvisionResult | null>(null)

  const organizationPreview = useMemo(
    () => organizationName.trim() || defaultOrganizationName(customerName),
    [customerName, organizationName]
  )

  async function submitProvision(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail,
          customerName,
          organizationName,
          slugOverride,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Provisioning failed.')
      }

      setResult(data)
      setCustomerEmail('')
      setCustomerName('')
      setOrganizationName('')
      setSlugOverride('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed.')
    } finally {
      setLoading(false)
    }
  }

  async function copyInstructions() {
    if (!result) return
    await navigator.clipboard.writeText(
      [
        `Login: ${result.loginUrl}`,
        `Email: ${result.email}`,
        `Temporary password: ${result.tempPassword}`,
        '',
        'After signing in, go to Settings -> Account and update your password.',
      ].join('\n')
    )
  }

  function resetResult() {
    setResult(null)
    setError(null)
  }

  return (
    <div className="grid min-w-0 gap-6">
      <form
        onSubmit={submitProvision}
        className="grid gap-4 rounded-md border border-border/70 bg-card p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer-email">Customer email</Label>
            <Input
              id="customer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer name</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="organization-name">Organization name</Label>
            <Input
              id="organization-name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder={organizationPreview || "Customer's Org"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug-override">Slug override</Label>
            <Input
              id="slug-override"
              value={slugOverride}
              onChange={(e) => setSlugOverride(e.target.value)}
              placeholder="auto-generated"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3 border-t border-border/70 pt-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Provisioning...' : 'Provision customer'}
          </Button>
        </div>
      </form>

      {result && (
        <section className="grid min-w-0 gap-4 rounded-md border border-border/70 bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Customer provisioned</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Share the temporary credentials out of band.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyInstructions}>
                <Clipboard className="size-4" />
                Copy
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetResult}>
                <RotateCcw className="size-4" />
                Clear
              </Button>
            </div>
          </div>

          <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Organization</dt>
              <dd className="break-words font-medium">{result.organizationName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="break-all font-medium">{result.slug}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Login URL</dt>
              <dd className="break-all font-medium">{result.loginUrl}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Customer email</dt>
              <dd className="break-all font-medium">{result.email}</dd>
            </div>
          </dl>

          <div className="rounded-md border border-border/70 bg-background p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-primary" />
              Temporary password
            </div>
            <code className="block break-all rounded bg-muted px-3 py-2 text-sm">
              {result.tempPassword}
            </code>
          </div>

          <p className="text-sm text-muted-foreground">
            Send the customer their login URL, email, and temporary password. After signing in,
            they should go to Settings - Account and update their password.
          </p>

          <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
            <Link
              href={`/${result.slug}/dashboard`}
              className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}
            >
              <ExternalLink className="size-4" />
              Open customer dashboard
            </Link>
            <Link
              href="/admin/provision"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}
            >
              Provision another
            </Link>
            {adminTenantSlug && (
              <Link
                href={`/${adminTenantSlug}/dashboard`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
              >
                Back to dashboard
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
