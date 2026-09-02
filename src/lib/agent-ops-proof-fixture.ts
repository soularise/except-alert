// ER-0039 local display fixture. Curated from ER-0035's retained source JSONL,
// replay manifest, reconciliation report, and audit evidence report.
// It is deliberately fixed, read-only, and not a live Relay or ExceptAlert query.

export type ProofStatus = 'completed' | 'failed'

export type ProofTimelineEvent = {
  occurredAt: string
  type: string
  title: string
  detail: string
  tone?: 'warning' | 'error'
  provenance: string
  rawEvidence: Record<string, unknown>
}

export type AgentOpsProofRun = {
  runId: string
  status: ProofStatus
  duration: string
  source: string
  proofScope: string
  summary: string
  checkpoints: number
  auditSummary: string
  hasAttentionDeviation: boolean
  timeline: ProofTimelineEvent[]
  collapsedActivity: {
    count: number
    range: string
    kinds: string
  }
  caveats: string[]
}

const localProofCaveats = [
  'Local fixture',
  'Replayed ER-0035 evidence',
  'Non-production',
  'Read-only proof',
]

export const agentOpsProofRuns: AgentOpsProofRun[] = [
  {
    runId: 'run-er0032-healthy-30m-detached',
    status: 'completed',
    duration: '30 minutes',
    source: 'proof_harness via agent-observation',
    proofScope: 'local fixture replay',
    summary: 'Completed as expected. No attention-worthy exception was retained for this run.',
    checkpoints: 4,
    auditSummary: '36 curated source events; retained in ER-0035 replay evidence and audit reconciliation.',
    hasAttentionDeviation: false,
    timeline: [
      {
        occurredAt: '2026-08-29T15:23:17Z',
        type: 'run.started',
        title: 'Run started',
        detail: 'The local proof run and research agent started.',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'run.started', state: 'running', provenance_mode: 'reported' },
      },
      {
        occurredAt: '2026-08-29T15:53:17Z',
        type: 'checkpoint.created',
        title: 'Fourth checkpoint retained',
        detail: 'Four retained checkpoints document the completed fixture cycles.',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'checkpoint.created', cycle: 4, artifact_ref: 'checkpoint-04.json' },
      },
      {
        occurredAt: '2026-08-29T15:53:17Z',
        type: 'agent.completed',
        title: 'Agent completed',
        detail: 'The participating agent completed before the run terminal event.',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'agent.completed', state: 'completed' },
      },
      {
        occurredAt: '2026-08-29T15:53:17Z',
        type: 'run.completed',
        title: 'Run completed',
        detail: 'The run reached its successful terminal state.',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'run.completed', state: 'completed' },
      },
      {
        occurredAt: '2026-08-29T16:10:19Z',
        type: 'evaluation.passed',
        title: 'Evaluation passed',
        detail: 'The retained local proof evaluation passed after run completion.',
        provenance: 'observed by er-0031-local-validator',
        rawEvidence: { event_type: 'evaluation.passed', outcome: 'passed' },
      },
    ],
    collapsedActivity: {
      count: 31,
      range: '15:23:17Z to 15:53:17Z',
      kinds: '4 heartbeats, 4 progress updates, 8 tool events, 6 waiting records, and supporting artifact/evaluation activity',
    },
    caveats: localProofCaveats,
  },
  {
    runId: 'run-er0033-silence-90m-detached',
    status: 'failed',
    duration: '90 minutes',
    source: 'proof_harness via agent-observation',
    proofScope: 'local fixture replay',
    summary: 'Failed after a retained expected-heartbeat gap. The deviation is one grouped proof finding, not a live ExceptAlert exception.',
    checkpoints: 4,
    auditSummary: '37 curated source events; retained in ER-0035 replay evidence and audit reconciliation.',
    hasAttentionDeviation: true,
    timeline: [
      {
        occurredAt: '2026-08-29T18:19:46Z',
        type: 'run.started',
        title: 'Run started',
        detail: 'The controlled failure-mode local proof and research agent started.',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'run.started', state: 'running', provenance_mode: 'reported' },
      },
      {
        occurredAt: '2026-08-29T18:49:46Z',
        type: 'run.waiting',
        title: 'Heartbeat expectation retained',
        detail: 'An agent heartbeat was expected by 18:49:47Z after checkpoint 2. This expectation makes the later absence meaningful.',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'run.waiting', expected_by: '2026-08-29T18:49:47Z', expected_next_event: ['agent.heartbeat'] },
      },
      {
        occurredAt: '2026-08-29T18:49:46Z',
        type: 'agent.heartbeat',
        title: 'Last observed heartbeat',
        detail: 'The final retained heartbeat preceded the expected-by gap.',
        provenance: 'observed by er-0031-local-harness',
        rawEvidence: { event_type: 'agent.heartbeat', cycle: 2, state: 'running' },
      },
      {
        occurredAt: '2026-08-29T19:49:46Z',
        type: 'checkpoint.created',
        title: 'Fourth checkpoint retained',
        detail: 'Later retained progress provides context for the missing expected heartbeat.',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'checkpoint.created', cycle: 4, artifact_ref: 'checkpoint-04.json' },
      },
      {
        occurredAt: '2026-08-29T19:49:46Z',
        type: 'controller.silence_detected',
        title: 'Silence detected from retained local proof evidence',
        detail: 'Expected heartbeat absent while later progress was retained. This is manual, local, derived evidence, not native telemetry or a live controller result.',
        tone: 'warning',
        provenance: 'controller-derived; manual local derivation; controller_implemented=false',
        rawEvidence: {
          event_type: 'controller.silence_detected',
          provenance_mode: 'derived',
          derivation_kind: 'manual_local_proof',
          controller_implemented: false,
          input_event_ids: ['evt_622f40f9b5c1b0769630', 'evt_93c3bd9fec8dbb8b919b'],
        },
      },
      {
        occurredAt: '2026-08-29T19:49:46Z',
        type: 'agent.failed',
        title: 'Agent failed',
        detail: 'The participating agent reached a distinct failed terminal state.',
        tone: 'error',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'agent.failed', state: 'failed' },
      },
      {
        occurredAt: '2026-08-29T19:49:46Z',
        type: 'run.failed',
        title: 'Run failed',
        detail: 'The run reached a failed terminal state. It remains one grouped deviation with its supporting evidence.',
        tone: 'error',
        provenance: 'reported by er-0031-local-harness',
        rawEvidence: { event_type: 'run.failed', state: 'failed' },
      },
      {
        occurredAt: '2026-08-29T21:26:18Z',
        type: 'evaluation.passed',
        title: 'Evaluation passed after validator correction',
        detail: 'The retained validation passed after correction; the earlier pre-fix validator record was excluded from ER-0035 replay.',
        provenance: 'observed by er-0031-local-validator',
        rawEvidence: { event_type: 'evaluation.passed', outcome: 'passed', validator_correction: true },
      },
    ],
    collapsedActivity: {
      count: 29,
      range: '18:19:46Z to 19:49:46Z',
      kinds: '2 heartbeats, 4 progress updates, 8 tool events, 8 waiting records, and supporting artifact/evaluation activity',
    },
    caveats: [...localProofCaveats, 'No controller, notification, or action behavior'],
  },
]

export const agentOpsAuditReference = {
  reconciliation: 'ER-0035 Reconciliation Report: 73 selected source events, 73 normalized rows, 146 audit rows, and 73 second-pass duplicates.',
  audit: 'ER-0035 Audit Evidence Report: raw harness envelopes, normalized fields, and local JSONL audit output were retained.',
}
