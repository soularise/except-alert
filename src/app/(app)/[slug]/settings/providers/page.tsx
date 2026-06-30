'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useTenant } from '@/components/TenantProvider'

type ProviderItem = {
  id: string
  name: string
  icon: string
  description: string
  signatureHeader: string | null
  signatureAlgorithm: string
  signatureLabel: string
  secretRequired: boolean
  secretLabel: string
  secretPlaceholder: string
  configHelp: string | null
  docsUrl: string
  configured: boolean
  webhookUrl: string | null
  webhookUrlError: string | null
}

export default function ProvidersPage() {
  const { tenant, role } = useTenant()
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [providerLimit, setProviderLimit] = useState<number | null>(null)
  const [configuredProviderCount, setConfiguredProviderCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState<string | null>(null)
  const [secretDraft, setSecretDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResult, setTestResult] =
    useState<{ providerId: string; ok: boolean; text: string; eventId?: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canManage = role === 'owner' || role === 'admin'
  const atProviderLimit = providerLimit !== null && configuredProviderCount >= providerLimit

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch(`/api/${tenant.slug}/providers`)
      if (!res.ok) throw new Error('Failed to load sources')
      const data = await res.json() as {
        providers: ProviderItem[]
        providerLimit: number | null
        configuredProviderCount: number
      }
      setProviders(data.providers)
      setProviderLimit(data.providerLimit)
      setConfiguredProviderCount(data.configuredProviderCount)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources')
    } finally {
      setLoading(false)
    }
  }, [tenant.slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProviders()
  }, [loadProviders])

  function openConfigure(providerId: string) {
    setConfiguring(providerId)
    setSecretDraft('')
    setSaveError(null)
    setTestResult(null)
  }

  function cancelConfigure() {
    setConfiguring(null)
    setSecretDraft('')
    setSaveError(null)
    setTestResult(null)
  }

  async function handleSave(e: React.FormEvent, providerId: string) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/${tenant.slug}/providers/${providerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret_key: secretDraft }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Save failed')
      }
      await loadProviders()
      setConfiguring(null)
      setSecretDraft('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(providerId: string, providerName: string) {
    if (!window.confirm(`Remove ${providerName}? This will stop webhook ingestion for this provider.`)) return
    try {
      await fetch(`/api/${tenant.slug}/providers/${providerId}`, { method: 'DELETE' })
      await loadProviders()
      if (configuring === providerId) cancelConfigure()
    } catch {
      // ignore — provider list will refresh on next load
    }
  }

  async function handleTest(providerId: string) {
    setTestingProvider(providerId)
    setTestResult(null)
    try {
      const res = await fetch(`/api/${tenant.slug}/providers/${providerId}/test`, { method: 'POST' })
      const data = await res.json() as { ok?: boolean; eventId?: string; error?: string }
      if (res.status === 429) {
        setTestResult({ providerId, ok: false, text: 'Rate limited. Wait 30 seconds between tests.' })
      } else if (!res.ok || !data.ok) {
        setTestResult({ providerId, ok: false, text: data.error ?? 'Test failed.' })
      } else {
        setTestResult({ providerId, ok: true, text: 'Test event sent successfully.', eventId: data.eventId })
      }
    } catch {
      setTestResult({ providerId, ok: false, text: 'Test failed. Network error.' })
    } finally {
      setTestingProvider(null)
    }
  }

  function handleCopy(text: string, providerId: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(providerId)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(null), 2000)
    })
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading sources...</p>
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="w-full max-w-5xl space-y-3" style={{ width: '960px', maxWidth: '100%' }}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Sources</h2>
        <p className="text-sm text-muted-foreground">
          Connect webhook sources to ExceptAlert and copy their ingest URLs.
        </p>
        {providerLimit !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your plan includes {providerLimit} configured source{providerLimit === 1 ? '' : 's'}.
            {atProviderLimit
              ? ' Remove the current source before configuring a replacement.'
              : ' Test events appear in the dashboard and do not count toward monthly usage.'}
          </p>
        )}
      </div>

      {providers.map((provider) => {
        const isConfiguring = configuring === provider.id
        const isCopied = copied === provider.id
        const isCopiedPanel = copied === `${provider.id}-panel`
        const isTesting = testingProvider === provider.id
        const providerTestResult = testResult?.providerId === provider.id ? testResult : null

        return (
          <div key={provider.id} className="rounded-lg border bg-card">
            {/* Card header */}
            <div className="flex items-start justify-between gap-4 p-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-xl leading-none mt-0.5">{provider.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{provider.name}</span>
                    {provider.configured ? (
                      <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Not configured
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                  {provider.configured && !isConfiguring && (
                    <div className="flex items-center gap-2 mt-2">
                      {provider.webhookUrl ? (
                        <>
                          <code className="max-w-xl truncate text-xs text-muted-foreground">
                            {provider.webhookUrl}
                          </code>
                          <button
                            onClick={() => handleCopy(provider.webhookUrl!, provider.id)}
                            className="text-xs text-primary hover:underline shrink-0"
                          >
                            {isCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-destructive">{provider.webhookUrlError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2 shrink-0">
                  {provider.configured ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isTesting}
                        onClick={() => handleTest(provider.id)}
                      >
                        {isTesting ? 'Sending...' : 'Send Test'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => isConfiguring ? cancelConfigure() : openConfigure(provider.id)}
                      >
                        {isConfiguring ? 'Cancel' : 'Edit'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemove(provider.id, provider.name)}
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={atProviderLimit}
                      onClick={() => isConfiguring ? cancelConfigure() : openConfigure(provider.id)}
                      title={atProviderLimit ? 'Remove the current source before configuring a replacement' : undefined}
                    >
                      {isConfiguring ? 'Cancel' : 'Configure'}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {provider.configured && !isConfiguring && providerTestResult && (
              <div className={`mx-4 mb-4 rounded-md p-3 text-sm ${providerTestResult.ok ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-destructive/10 text-destructive'}`}>
                <p>{providerTestResult.text}</p>
                {providerTestResult.ok && providerTestResult.eventId && (
                  <Link
                    href={`/${tenant.slug}/dashboard`}
                    className="mt-1 inline-block text-xs underline"
                  >
                    View in dashboard
                  </Link>
                )}
              </div>
            )}

            {/* Inline configure panel */}
            {isConfiguring && (
              <div className="border-t px-4 pb-4 pt-4 space-y-4 bg-muted/30">
                <form onSubmit={(e) => handleSave(e, provider.id)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`secret-${provider.id}`}>{provider.secretLabel}</Label>
                    <Input
                      id={`secret-${provider.id}`}
                      type="password"
                      autoComplete="new-password"
                      placeholder={
                        provider.configured
                          ? '••••••••••  (leave blank to keep current)'
                          : provider.secretPlaceholder
                      }
                      value={secretDraft}
                      onChange={(e) => setSecretDraft(e.target.value)}
                    />
                    {provider.configHelp && (
                      <p className="text-xs text-muted-foreground">{provider.configHelp}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Your Webhook URL</Label>
                    {provider.webhookUrl ? (
                      <>
                        <div className="flex items-center gap-2">
                          <code className="min-w-0 flex-1 break-all rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                            {provider.webhookUrl}
                          </code>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(provider.webhookUrl!, `${provider.id}-panel`)}
                          >
                            {isCopiedPanel ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Configure this URL in {provider.name}&apos;s webhook settings.
                        </p>
                      </>
                    ) : (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {provider.webhookUrlError}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>Algorithm: {provider.signatureLabel}</span>
                    {provider.signatureHeader && (
                      <span>Header: {provider.signatureHeader}</span>
                    )}
                    {provider.docsUrl && (
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Docs ↗
                      </a>
                    )}
                  </div>

                  {saveError && (
                    <p className="text-sm text-destructive">{saveError}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        saving ||
                        (provider.secretRequired && !secretDraft.trim() && !provider.configured)
                      }
                    >
                      {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isTesting || !provider.configured}
                      onClick={() => handleTest(provider.id)}
                      title={!provider.configured ? 'Save a secret first' : undefined}
                    >
                      {isTesting ? 'Sending...' : 'Send Test Event'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelConfigure}
                    >
                      Cancel
                    </Button>
                  </div>

                  {providerTestResult && (
                    <div className={`rounded-md p-3 text-sm ${providerTestResult.ok ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-destructive/10 text-destructive'}`}>
                      <p>{providerTestResult.text}</p>
                      {providerTestResult.ok && providerTestResult.eventId && (
                        <Link
                          href={`/${tenant.slug}/dashboard`}
                          className="mt-1 inline-block text-xs underline"
                        >
                          View in dashboard
                        </Link>
                      )}
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
