'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ActionTemplate {
  id: string
  category: string
  label: string
  actionType: string
  config: unknown
  createdAt: string
}

interface HitlActionPanelProps {
  eventId: string
  category: string
  onStatusChange?: () => void
}

export function HitlActionPanel({ eventId, category, onStatusChange }: HitlActionPanelProps) {
  const [templates, setTemplates] = useState<ActionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, { alreadyExecuted?: boolean; error?: string; success?: boolean }>>({})

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json() as Promise<{ templates: ActionTemplate[] }>)
      .then(({ templates: all }) => setTemplates(all.filter((t) => t.category === category)))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [category])

  async function handleAction(templateId: string) {
    setExecuting((prev) => ({ ...prev, [templateId]: true }))
    setResults((prev) => ({ ...prev, [templateId]: {} }))

    try {
      const res = await fetch(`/api/events/${eventId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      const data = (await res.json()) as {
        success: boolean
        alreadyExecuted?: boolean
        actionId?: string
        error?: string
      }

      setResults((prev) => ({
        ...prev,
        [templateId]: {
          success: data.success,
          alreadyExecuted: data.alreadyExecuted,
          error: data.error,
        },
      }))

      if (data.success && !data.alreadyExecuted) {
        onStatusChange?.()
      }
    } catch {
      setResults((prev) => ({
        ...prev,
        [templateId]: { success: false, error: 'Request failed' },
      }))
    } finally {
      setExecuting((prev) => ({ ...prev, [templateId]: false }))
    }
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions configured for this category.{' '}
            <Link href="/dashboard/templates" className="underline hover:text-foreground">
              Add one &rarr;
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((template) => {
              const result = results[template.id]
              const isExecuting = executing[template.id] ?? false

              return (
                <div key={template.id} className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant={result?.alreadyExecuted ? 'outline' : 'default'}
                    disabled={isExecuting || result?.alreadyExecuted === true}
                    onClick={() => handleAction(template.id)}
                  >
                    {isExecuting ? 'Executing…' : template.label}
                  </Button>
                  {result?.alreadyExecuted && (
                    <span className="text-xs text-muted-foreground">Already executed</span>
                  )}
                  {result?.success === true && !result.alreadyExecuted && (
                    <span className="text-xs text-green-600">Action executed successfully</span>
                  )}
                  {result?.error && (
                    <span className="text-xs text-destructive">{result.error}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
