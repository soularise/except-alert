# Webhook Replay Concept

## Purpose

Add an operator-facing capability to reprocess a recorded inbound webhook after a mapping, configuration, or downstream-processing problem. The initial product language should be **Reprocess recorded webhook**, rather than implying an unqualified replay that could duplicate customer-facing effects.

This is a conceptual design only. It does not authorize or prescribe implementation changes.

## Product boundary

Relay is the system of record for an inbound provider delivery. It verifies the request, retains the original payload, normalizes the provider fact, and records its audit trail.

ExceptAlert owns the authenticated operator experience, replay permissions, policy choices, alert and controller evaluation, notification choices, and the user-visible activity history.

```text
ExceptAlert Event or Activity detail
  -> operator requests a replay
  -> Relay loads the original verified delivery
  -> Relay applies the current normalizer
  -> ExceptAlert presents the result and linked audit record
```

## Operator modes

### Dry run

Dry run is the default. It uses the original recorded delivery to show how the **current** provider mapping would interpret it, without creating an event or performing side effects.

The result should show:

- Proposed normalized event type and tags
- Correlation and deduplication decision
- Mapping or validation errors
- Potential baseline, alert, and controller impact
- The mapping/configuration version used

Dry run must not create alerts, execute actions, schedule controller work, or send Slack, Telegram, email, or other notifications.

### Apply replay

Apply replay is an explicitly confirmed, privileged operation. It creates a distinct replay execution, linked to the original delivery, and allows the resulting fact to move through the normal downstream evaluation path.

The initial version should keep notification redelivery and HITL action execution out of this operation. If those are ever supported, they should be separate, explicit operations with their own authorization, idempotency keys, confirmation, and audit records.

## Data and audit model

The original delivery and original normalized result remain immutable. A replay produces a derived result and a durable audit record, not an overwrite.

Each replay should retain at least:

- `replay_run_id`
- `replay_of_event_id` or original delivery identifier
- Tenant and provider identity
- Initiating user and operator-supplied reason
- Original receipt timestamp and replay timestamp
- Normalizer and provider-mapping version
- Mode: dry run or apply
- Outcome: processed, duplicate, validation failed, or processing failed
- Links to the derived event, alert, controller work, and audit entries when created

This provenance lets an operator distinguish a real vendor delivery from an administrative reprocessing operation during investigation and compliance export.

## Idempotency and safety

Relay's existing replay-safe ingestion behavior is a foundation, but intentional reprocessing needs a separate replay identity. A valid Apply replay must not silently collapse into the original event merely because the provider event ID is identical.

At the same time, downstream effects require independent protection. An alert, action, notification, or scheduled controller stage should not repeat simply because an operator reprocessed an input. Existing action idempotency needs to include the appropriate replay or stage identity only where a product rule intentionally permits a new side effect.

## Suggested first slice

1. Add an admin-only **Replay** section to an Event or Activity detail page.
2. Support dry-run reprocessing for a small, well-understood provider set.
3. Show a before-and-after comparison of the original and candidate normalized results.
4. Write a Relay audit record for every request and outcome, then link it in ExceptAlert.
5. Validate the experience with a real mapping correction or failed-processing scenario.
6. Add Apply replay only after the dry-run flow makes provenance and side-effect behavior clear.

## Later extensions

- Comparison against a historical mapping version for forensic analysis
- Bulk dry runs for a bounded time range after a mapping correction
- Controlled apply-replay queues with rate limits and tenant-level permissions
- Explicit notification redelivery or action retrigger operations

These should remain later work. The initial success criterion is one explainable, tenant-safe loop that helps an operator understand and correct how a recorded webhook would be handled today.
