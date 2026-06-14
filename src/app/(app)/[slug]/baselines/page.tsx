'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useTenant } from '@/components/TenantProvider'
import { PageHeader } from '@/components/PageHeader'
import type { EventCategory } from '@/lib/providers'

function formatLastAlerted(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

const WINDOW_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: '6 hours', value: 360 },
  { label: '24 hours', value: 1440 }
]

interface Baseline {
  id: string
  category: string
  threshold: number
  windowMinutes: number
  lastAlertedAt: string | null
  createdAt: string
}

interface ProviderGroup {
  providerId: string
  providerName: string
  categories: EventCategory[]
}

export default function BaselinesPage() {
  const { tenant } = useTenant()
  const [baselineList, setBaselineList] = useState<Baseline[]>([])
  const [loading, setLoading] = useState(true)
  const [providerGroups, setProviderGroups] = useState<ProviderGroup[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBaseline, setEditingBaseline] = useState<Baseline | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [category, setCategory] = useState('')
  const [threshold, setThreshold] = useState('')
  const [windowMinutes, setWindowMinutes] = useState('60')

  const fetchBaselines = useCallback(async () => {
    try {
      const res = await fetch(`/api/${tenant.slug}/baselines`)
      const data = await res.json()
      setBaselineList(data.baselines ?? [])
    } finally {
      setLoading(false)
    }
  }, [tenant.slug])

  useEffect(() => {
    fetch(`/api/${tenant.slug}/providers`)
      .then((r) => r.json())
      .then((data) => {
        const groups: ProviderGroup[] = (data.providers ?? [])
          .filter((p: { configured: boolean; eventCategories?: EventCategory[] }) =>
            p.configured && p.eventCategories && p.eventCategories.length > 0
          )
          .map((p: { id: string; name: string; eventCategories: EventCategory[] }) => ({
            providerId: p.id,
            providerName: p.name,
            categories: p.eventCategories,
          }))
        setProviderGroups(groups)
      })
      .catch(() => {})
  }, [tenant.slug])

  useEffect(() => {
    fetchBaselines()
  }, [fetchBaselines])

  function openAddDialog() {
    setEditingBaseline(null)
    setCategory('')
    setThreshold('')
    setWindowMinutes('60')
    setFormError(null)
    setDialogOpen(true)
  }

  function openEditDialog(baseline: Baseline) {
    setEditingBaseline(baseline)
    setCategory(baseline.category)
    setThreshold(String(baseline.threshold))
    setWindowMinutes(String(baseline.windowMinutes))
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const thresholdNum = parseInt(threshold, 10)
    if (!category.trim()) {
      setFormError('Category is required')
      return
    }
    if (isNaN(thresholdNum) || thresholdNum < 1) {
      setFormError('Threshold must be a positive number')
      return
    }

    setSubmitting(true)
    try {
      const url = editingBaseline
        ? `/api/${tenant.slug}/baselines/${editingBaseline.id}`
        : `/api/${tenant.slug}/baselines`
      const method = editingBaseline ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          threshold: thresholdNum,
          window_minutes: parseInt(windowMinutes, 10)
        })
      })
      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error ?? 'Something went wrong')
        return
      }
      setDialogOpen(false)
      await fetchBaselines()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(baseline: Baseline) {
    if (!window.confirm(`Delete baseline for "${baseline.category}"?`)) return
    await fetch(`/api/${tenant.slug}/baselines/${baseline.id}`, {
      method: 'DELETE'
    })
    await fetchBaselines()
  }

  function windowLabel(minutes: number) {
    return (
      WINDOW_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} min`
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Baselines" />
      <div className="px-6 py-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Baselines</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Alert when event counts exceed thresholds
            </p>
          </div>
          <Button onClick={openAddDialog}>Add Baseline</Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : baselineList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No baselines yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Last Alerted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baselineList.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    {b.category}
                  </TableCell>
                  <TableCell>{b.threshold} events</TableCell>
                  <TableCell>{windowLabel(b.windowMinutes)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatLastAlerted(b.lastAlertedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(b)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(b)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBaseline ? 'Edit Baseline' : 'Add Baseline'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                {providerGroups.length > 0 ? (
                  <Select
                    value={category}
                    onValueChange={(v) => { if (v) setCategory(v) }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an event type" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerGroups.map((group) => (
                        <SelectGroup key={group.providerId}>
                          <SelectLabel>{group.providerName}</SelectLabel>
                          {group.categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No providers configured yet. Set up a provider first.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bl-threshold">Threshold (events)</Label>
                <Input
                  id="bl-threshold"
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Window</Label>
                <Select
                  value={windowMinutes}
                  onValueChange={(v) => {
                    if (v) setWindowMinutes(v)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? 'Saving...'
                    : editingBaseline
                      ? 'Save Changes'
                      : 'Create Baseline'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
