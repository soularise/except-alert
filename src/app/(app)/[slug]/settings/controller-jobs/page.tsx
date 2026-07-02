'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Clock, Pencil, Pause, Play, RotateCw, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTenant } from '@/components/TenantProvider'
import { limitsFor } from '@/lib/plan-limits'

type ControllerJobType = 'health_ping' | 'dead_letter' | 'cron_deadline' | 'deviation'
type ControllerStatus = 'pending' | 'ok' | 'alert' | 'error'

type ControllerJob = {
  id: string
  name: string
  type: ControllerJobType
  config: Record<string, unknown>
  cronExpr: string
  timezone: string
  enabled: boolean
  nextRunAt: string
  lastRunAt: string | null
  lastStatus: ControllerStatus
  lastResult: Record<string, unknown> | null
  createdAt: string
}

type ProviderItem = {
  id: string
  name: string
  configured: boolean
}

type JobDraft = {
  name: string
  type: ControllerJobType
  providerId: string
  url: string
  expectedStatus: string
  timeoutMs: string
  maximumSilenceHours: string
  minimumEvents: string
  windowHours: string
  sigmaThreshold: string
  baselineDays: string
  direction: 'spike' | 'drop' | 'both'
  cronExpr: string
  timezone: string
}

const DEFAULT_DRAFT: JobDraft = {
  name: '',
  type: 'dead_letter',
  providerId: '',
  url: 'https://',
  expectedStatus: '200',
  timeoutMs: '5000',
  maximumSilenceHours: '24',
  minimumEvents: '1',
  windowHours: '24',
  sigmaThreshold: '3',
  baselineDays: '14',
  direction: 'both',
  cronExpr: '*/5 * * * *',
  timezone: 'UTC',
}

const TYPE_LABELS: Record<ControllerJobType, string> = {
  health_ping: 'Health ping',
  dead_letter: 'Silence',
  cron_deadline: 'Deadline',
  deviation: 'Deviation',
}

export default function ControllerJobsPage() {
  const { tenant, role } = useTenant()
  const [jobs, setJobs] = useState<ControllerJob[]>([])
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [draft, setDraft] = useState<JobDraft>(DEFAULT_DRAFT)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [runningJobId, setRunningJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const canManage = role === 'owner' || role === 'admin'
  const controllerLimit = limitsFor(tenant.plan).controllerJobs
  const atControllerLimit = controllerLimit !== null && jobs.length >= controllerLimit
  const canCreate = canManage && !atControllerLimit && controllerLimit !== 0
  const canShowForm = canCreate || Boolean(editingJobId)
  const configuredProviders = useMemo(
    () => providers.filter((provider) => provider.configured),
    [providers]
  )
  const scheduleDescription = useMemo(
    () => describeCronSchedule(draft.cronExpr, draft.timezone),
    [draft.cronExpr, draft.timezone]
  )

  const loadControllerState = useCallback(async () => {
    setLoading(true)
    try {
      const [jobsRes, providersRes] = await Promise.all([
        fetch(`/api/${tenant.slug}/controller-jobs`),
        fetch(`/api/${tenant.slug}/providers`),
      ])
      if (!jobsRes.ok) throw new Error('Failed to load controller jobs')
      if (!providersRes.ok) throw new Error('Failed to load sources')

      const jobsData = await jobsRes.json() as { jobs: ControllerJob[] }
      const providerData = await providersRes.json() as { providers: ProviderItem[] }
      setJobs(jobsData.jobs)
      setProviders(providerData.providers)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load controller jobs')
    } finally {
      setLoading(false)
    }
  }, [tenant.slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadControllerState()
  }, [loadControllerState])

  function updateDraft<K extends keyof JobDraft>(key: K, value: JobDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function buildPayload(enabled = true) {
    const base = {
      name: draft.name,
      type: draft.type,
      cronExpr: draft.cronExpr,
      timezone: draft.timezone,
      enabled,
    }

    if (draft.type === 'health_ping') {
      return {
        ...base,
        config: {
          url: draft.url,
          expectedStatus: Number(draft.expectedStatus),
          timeoutMs: Number(draft.timeoutMs),
        },
      }
    }

    if (draft.type === 'dead_letter') {
      return {
        ...base,
        config: {
          providerId: draft.providerId,
          maximumSilenceHours: Number(draft.maximumSilenceHours),
        },
      }
    }

    if (draft.type === 'cron_deadline') {
      return {
        ...base,
        config: {
          providerId: draft.providerId,
          minimumEvents: Number(draft.minimumEvents),
          windowHours: Number(draft.windowHours),
        },
      }
    }

    return {
      ...base,
      config: {
        providerId: draft.providerId,
        sigmaThreshold: Number(draft.sigmaThreshold),
        baselineDays: Number(draft.baselineDays),
        direction: draft.direction,
      },
    }
  }

  async function saveJob(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)

    try {
      const editingJob = editingJobId ? jobs.find((job) => job.id === editingJobId) : null
      const res = await fetch(
        editingJob
          ? `/api/${tenant.slug}/controller-jobs/${editingJob.id}`
          : `/api/${tenant.slug}/controller-jobs`,
        {
          method: editingJob ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(editingJob?.enabled ?? true)),
        }
      )
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? (editingJob ? 'Failed to update controller job' : 'Failed to create controller job'))
      }
      resetForm()
      await loadControllerState()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save controller job')
    } finally {
      setSaving(false)
    }
  }

  function editJob(job: ControllerJob) {
    setDraft(jobToDraft(job))
    setEditingJobId(job.id)
    setFormError(null)
    setError(null)
  }

  function resetForm() {
    setDraft(DEFAULT_DRAFT)
    setEditingJobId(null)
    setFormError(null)
  }

  async function toggleJob(job: ControllerJob) {
    try {
      const res = await fetch(`/api/${tenant.slug}/controller-jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !job.enabled }),
      })
      if (!res.ok) throw new Error('Failed to update controller job')
      if (editingJobId === job.id) resetForm()
      await loadControllerState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update controller job')
    }
  }

  async function runJobNow(job: ControllerJob) {
    setRunningJobId(job.id)
    setError(null)

    try {
      const res = await fetch(`/api/${tenant.slug}/controller-jobs/${job.id}/trigger`, {
        method: 'POST',
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to run controller job')
      await loadControllerState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run controller job')
    } finally {
      setRunningJobId(null)
    }
  }

  async function deleteJob(job: ControllerJob) {
    if (!window.confirm(`Delete ${job.name}?`)) return

    try {
      const res = await fetch(`/api/${tenant.slug}/controller-jobs/${job.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete controller job')
      if (editingJobId === job.id) resetForm()
      await loadControllerState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete controller job')
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading controller jobs...</p>
  }

  return (
    <div className="w-full space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Controllers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Active monitoring definitions for {tenant.name}.
        </p>
        {controllerLimit !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            {jobs.length} of {controllerLimit} controller job{controllerLimit === 1 ? '' : 's'} configured.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {controllerLimit === 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Active monitoring requires Pro or Growth.</p>
          <p className="mt-1">The dashboard remains available on Free.</p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Jobs</h3>
        </div>
        {jobs.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            No controller jobs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell>{TYPE_LABELS[job.type]}</TableCell>
                    <TableCell>
                      <Badge variant={job.lastStatus === 'alert' || job.lastStatus === 'error' ? 'destructive' : 'secondary'}>
                        {job.enabled ? job.lastStatus : 'paused'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-1">
                        <code className="text-xs text-muted-foreground">{job.cronExpr}</code>
                        <span className="text-xs text-muted-foreground">{job.timezone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(job.lastRunAt)}
                    </TableCell>
                    <TableCell className="max-w-[180px] text-sm text-muted-foreground">
                      {formatResult(job.lastResult)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.enabled ? formatDate(job.nextRunAt) : '-'}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!job.enabled || runningJobId === job.id}
                            onClick={() => runJobNow(job)}
                          >
                            <RotateCw className="h-4 w-4" />
                            {runningJobId === job.id ? 'Running...' : 'Run now'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => editJob(job)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => toggleJob(job)}
                          >
                            {job.enabled ? (
                              <>
                                <Pause className="h-4 w-4" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4" />
                                Enable
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteJob(job)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {!canManage && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          Ask an admin or owner to manage controller jobs.
        </div>
      )}

      {canManage && controllerLimit !== 0 && atControllerLimit && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Your current plan includes {controllerLimit} controller job{controllerLimit === 1 ? '' : 's'}.</p>
        </div>
      )}

      {canShowForm && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">
                {editingJobId ? 'Edit job' : 'New job'}
              </h3>
            </div>
            {editingJobId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>

          <form
            onSubmit={saveJob}
            className="grid gap-4 rounded-md border bg-card p-4 sm:grid-cols-2"
          >
            <div className="grid gap-2">
              <Label htmlFor="controller-name">Name</Label>
              <Input
                id="controller-name"
                value={draft.name}
                onChange={(event) => updateDraft('name', event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="controller-type">Type</Label>
              <Select
                value={draft.type}
                onValueChange={(value) => {
                  if (value) updateDraft('type', value as ControllerJobType)
                }}
              >
                <SelectTrigger id="controller-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_ping">Health ping</SelectItem>
                  <SelectItem value="dead_letter">Silence</SelectItem>
                  <SelectItem value="cron_deadline">Deadline</SelectItem>
                  <SelectItem value="deviation">Deviation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.type === 'health_ping' ? (
              <HealthPingFields draft={draft} updateDraft={updateDraft} />
            ) : (
              <ProviderJobFields
                draft={draft}
                providers={configuredProviders}
                updateDraft={updateDraft}
              />
            )}

            <div className="grid gap-2">
              <Label htmlFor="controller-cron">Schedule</Label>
              <Input
                id="controller-cron"
                value={draft.cronExpr}
                onChange={(event) => updateDraft('cronExpr', event.target.value)}
                required
                aria-describedby="controller-cron-help"
              />
              <p id="controller-cron-help" className="text-xs leading-5 text-muted-foreground">
                {scheduleDescription}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="controller-timezone">Timezone</Label>
              <Input
                id="controller-timezone"
                value={draft.timezone}
                onChange={(event) => updateDraft('timezone', event.target.value)}
                required
              />
            </div>

            {formError && (
              <p className="sm:col-span-2 text-sm text-destructive">{formError}</p>
            )}

            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={saving || (draft.type !== 'health_ping' && !draft.providerId)}
              >
                {saving ? 'Saving...' : editingJobId ? 'Save job' : 'Create job'}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}

function HealthPingFields({
  draft,
  updateDraft,
}: {
  draft: JobDraft
  updateDraft: <K extends keyof JobDraft>(key: K, value: JobDraft[K]) => void
}) {
  return (
    <>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="controller-url">URL</Label>
        <Input
          id="controller-url"
          value={draft.url}
          onChange={(event) => updateDraft('url', event.target.value)}
          required
        />
      </div>
      <NumberField
        id="controller-status"
        label="Expected status"
        value={draft.expectedStatus}
        onChange={(value) => updateDraft('expectedStatus', value)}
      />
      <NumberField
        id="controller-timeout"
        label="Timeout ms"
        value={draft.timeoutMs}
        onChange={(value) => updateDraft('timeoutMs', value)}
      />
    </>
  )
}

function ProviderJobFields({
  draft,
  providers,
  updateDraft,
}: {
  draft: JobDraft
  providers: ProviderItem[]
  updateDraft: <K extends keyof JobDraft>(key: K, value: JobDraft[K]) => void
}) {
  return (
    <>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="controller-provider">Source</Label>
        <Select
          value={draft.providerId}
          onValueChange={(value) => {
            if (value) updateDraft('providerId', value)
          }}
        >
          <SelectTrigger id="controller-provider" className="w-full">
            <SelectValue placeholder="Select source" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {draft.type === 'dead_letter' && (
        <NumberField
          id="controller-silence"
          label="Maximum silence hours"
          value={draft.maximumSilenceHours}
          onChange={(value) => updateDraft('maximumSilenceHours', value)}
        />
      )}

      {draft.type === 'cron_deadline' && (
        <>
          <NumberField
            id="controller-minimum-events"
            label="Minimum events"
            value={draft.minimumEvents}
            onChange={(value) => updateDraft('minimumEvents', value)}
          />
          <NumberField
            id="controller-window"
            label="Window hours"
            value={draft.windowHours}
            onChange={(value) => updateDraft('windowHours', value)}
          />
        </>
      )}

      {draft.type === 'deviation' && (
        <>
          <NumberField
            id="controller-sigma"
            label="Sigma threshold"
            value={draft.sigmaThreshold}
            onChange={(value) => updateDraft('sigmaThreshold', value)}
          />
          <NumberField
            id="controller-baseline"
            label="Baseline days"
            value={draft.baselineDays}
            onChange={(value) => updateDraft('baselineDays', value)}
          />
          <div className="grid gap-2">
            <Label htmlFor="controller-direction">Direction</Label>
            <Select
              value={draft.direction}
              onValueChange={(value) => {
                if (value) updateDraft('direction', value as JobDraft['direction'])
              }}
            >
              <SelectTrigger id="controller-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spike">Spike</SelectItem>
                <SelectItem value="drop">Drop</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function formatResult(result: Record<string, unknown> | null) {
  if (!result) return '-'
  const outcome = typeof result.outcome === 'string' ? result.outcome : 'unknown'
  const durationMs = typeof result.durationMs === 'number' ? `${result.durationMs}ms` : null
  return durationMs ? `${outcome} (${durationMs})` : outcome
}

function describeCronSchedule(cronExpr: string, timezone: string) {
  const fields = cronExpr.trim().split(/\s+/)
  if (fields.length !== 5 || fields.some((field) => field.length === 0)) {
    return 'Use five cron fields: minute hour day month weekday.'
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields
  const zone = timezone.trim() || 'UTC'
  const zoneSuffix = ` (${zone})`

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute === '*' && hour === '*') return `Runs every minute${zoneSuffix}.`

    const minuteStep = cronStep(minute)
    if (minuteStep && hour === '*') {
      return `Runs every ${minuteStep} minutes${zoneSuffix}.`
    }

    if (minute === '0' && hour === '*') return `Runs hourly at minute 00${zoneSuffix}.`

    if (isCronNumber(minute, 0, 59) && isCronNumber(hour, 0, 23)) {
      return `Runs daily at ${padCronNumber(hour)}:${padCronNumber(minute)}${zoneSuffix}.`
    }
  }

  if (
    isCronNumber(minute, 0, 59) &&
    isCronNumber(hour, 0, 23) &&
    dayOfMonth === '*' &&
    month === '*' &&
    (dayOfWeek === '1-5' || dayOfWeek === '1,2,3,4,5')
  ) {
    return `Runs every weekday at ${padCronNumber(hour)}:${padCronNumber(minute)}${zoneSuffix}.`
  }

  if (
    isCronNumber(minute, 0, 59) &&
    isCronNumber(hour, 0, 23) &&
    isCronNumber(dayOfMonth, 1, 31) &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return `Runs monthly on day ${Number(dayOfMonth)} at ${padCronNumber(hour)}:${padCronNumber(minute)}${zoneSuffix}.`
  }

  return `Custom cron: minute ${minute}, hour ${hour}, day ${dayOfMonth}, month ${month}, weekday ${dayOfWeek}${zoneSuffix}.`
}

function cronStep(field: string) {
  const match = field.match(/^\*\/(\d+)$/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isInteger(value) && value > 0 && value <= 59 ? value : null
}

function isCronNumber(value: string, min: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
}

function padCronNumber(value: string) {
  return String(Number(value)).padStart(2, '0')
}

function jobToDraft(job: ControllerJob): JobDraft {
  const config = job.config ?? {}
  const draft = {
    ...DEFAULT_DRAFT,
    name: job.name,
    type: job.type,
    cronExpr: job.cronExpr,
    timezone: job.timezone,
  }

  if (job.type === 'health_ping') {
    return {
      ...draft,
      url: stringConfig(config, 'url', DEFAULT_DRAFT.url),
      expectedStatus: stringConfig(config, 'expectedStatus', DEFAULT_DRAFT.expectedStatus),
      timeoutMs: stringConfig(config, 'timeoutMs', DEFAULT_DRAFT.timeoutMs),
    }
  }

  if (job.type === 'dead_letter') {
    return {
      ...draft,
      providerId: stringConfig(config, 'providerId', ''),
      maximumSilenceHours: stringConfig(
        config,
        'maximumSilenceHours',
        DEFAULT_DRAFT.maximumSilenceHours
      ),
    }
  }

  if (job.type === 'cron_deadline') {
    return {
      ...draft,
      providerId: stringConfig(config, 'providerId', ''),
      minimumEvents: stringConfig(config, 'minimumEvents', DEFAULT_DRAFT.minimumEvents),
      windowHours: stringConfig(config, 'windowHours', DEFAULT_DRAFT.windowHours),
    }
  }

  return {
    ...draft,
    providerId: stringConfig(config, 'providerId', ''),
    sigmaThreshold: stringConfig(config, 'sigmaThreshold', DEFAULT_DRAFT.sigmaThreshold),
    baselineDays: stringConfig(config, 'baselineDays', DEFAULT_DRAFT.baselineDays),
    direction: directionConfig(config.direction),
  }
}

function stringConfig(config: Record<string, unknown>, key: string, fallback: string) {
  const value = config[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function directionConfig(value: unknown): JobDraft['direction'] {
  return value === 'spike' || value === 'drop' || value === 'both' ? value : DEFAULT_DRAFT.direction
}
