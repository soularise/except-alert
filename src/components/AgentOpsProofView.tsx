'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, CircleX, Database, FileSearch } from 'lucide-react'
import { agentOpsAuditReference, agentOpsProofRuns, type AgentOpsProofRun } from '@/lib/agent-ops-proof-fixture'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function StatusMark({ status }: { status: AgentOpsProofRun['status'] }) {
  return status === 'completed'
    ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
    : <CircleX className="size-4 text-destructive" aria-hidden="true" />
}

export function AgentOpsProofView() {
  const [selectedRunId, setSelectedRunId] = useState(agentOpsProofRuns[0].runId)
  const run = agentOpsProofRuns.find((item) => item.runId === selectedRunId) ?? agentOpsProofRuns[0]

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
        <p className="font-medium">Local replay evidence proof</p>
        <p className="mt-1 text-muted-foreground">
          Not production Agent Ops. This read-only view uses two fixed ER-0035 local-fixture replays. It has no live controller, notification, action, or database behavior.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside aria-label="Proof runs" className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fixed proof runs</p>
          {agentOpsProofRuns.map((item) => {
            const selected = item.runId === run.runId
            return (
              <button
                key={item.runId}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedRunId(item.runId)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex items-start gap-2">
                  <StatusMark status={item.status} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{item.runId}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{item.status} · {item.duration}</p>
                  </div>
                  <ChevronRight className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                {item.hasAttentionDeviation && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">One grouped proof deviation</p>
                )}
              </button>
            )
          })}
        </aside>

        <main className="min-w-0 space-y-6">
          <section>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <StatusMark status={run.status} />
                  <h2 className="break-all text-xl font-semibold tracking-tight">{run.runId}</h2>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{run.summary}</p>
              </div>
              <Badge variant="outline" className={run.status === 'failed' ? 'border-destructive/40 text-destructive' : 'border-emerald-600/40 text-emerald-700'}>
                {run.status}
              </Badge>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-muted-foreground">Duration</dt><dd className="font-medium">{run.duration}</dd></div>
              <div><dt className="text-muted-foreground">Checkpoints</dt><dd className="font-medium">{run.checkpoints} retained</dd></div>
              <div><dt className="text-muted-foreground">Source</dt><dd className="font-medium">{run.source}</dd></div>
              <div><dt className="text-muted-foreground">Proof scope</dt><dd className="font-medium">{run.proofScope}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Proof caveats">
              {run.caveats.map((caveat) => <Badge key={caveat} variant="secondary">{caveat}</Badge>)}
            </div>
          </section>

          {run.hasAttentionDeviation && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4 text-amber-600" /> One grouped deviation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Heartbeat silence and failed run.</span> The expected heartbeat was absent after the retained `expected_by` time, while later evidence was retained.</p>
                <p>Supporting records are shown in the timeline. The silence record is controller-derived, manually derived from local proof evidence, and explicitly not emitted by an implemented controller.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Material run timeline</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {run.timeline.map((event) => (
                <article key={`${event.type}-${event.occurredAt}`} className="relative border-l border-border pl-5">
                  <span className={cn('absolute -left-1.5 top-1.5 size-3 rounded-full bg-muted', event.tone === 'warning' && 'bg-amber-500', event.tone === 'error' && 'bg-destructive')} aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className={cn('font-medium', event.tone === 'warning' && 'text-amber-700 dark:text-amber-400', event.tone === 'error' && 'text-destructive')}>{event.title}</p>
                    <span className="text-xs text-muted-foreground">{formatTime(event.occurredAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.type} · {event.provenance}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-primary">Show retained material JSON</summary>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(event.rawEvidence, null, 2)}</pre>
                  </details>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSearch className="size-4" /> Collapsed lifecycle activity</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{run.collapsedActivity.count} retained routine records, {run.collapsedActivity.range}: {run.collapsedActivity.kinds}.</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-primary">Why these records are collapsed</summary>
                <p className="mt-2 text-sm text-muted-foreground">They remain audit evidence, but ordinary lifecycle activity does not become a separate attention item. Only expectation context needed to explain a deviation is promoted above.</p>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="size-4" /> Retained audit references</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{run.auditSummary}</p>
              <p>{agentOpsAuditReference.reconciliation}</p>
              <p>{agentOpsAuditReference.audit}</p>
              <p className="text-xs">Raw and normalized evidence is intentionally limited to the material-event expansions above. This proof does not expose a full audit dump or read vault files at runtime.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
