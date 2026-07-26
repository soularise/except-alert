# AI Work Watchdog

The AI Work Watchdog is an internal, opt-in Phase 3D dogfood adapter. It supervises a command's observable lifecycle. It does not inspect prompts, source code, command arguments, terminal output, environment variables, credentials, or tool payloads.

## Setup

1. In **Settings → Sources**, configure **AI Work Watchdog** with a unique token.
2. Set the Relay URL, organization ingress key, and the configured token in the shell that runs the wrapper.
3. Run a named command through the wrapper.

```sh
EA_RELAY_URL=https://relay.example.com \
EA_TENANT_REF=your-organization-ingress-key \
EA_WATCHDOG_TOKEN=your-configured-token \
node scripts/ai-work-watchdog.mjs --label "Nightly export review" -- codex exec "review the export job"
```

The safe label is visible in ExceptAlert. Do not put a prompt, customer data, a path, or a secret in it.

## Events

The wrapper emits `agent.run.started`, a heartbeat every 60 seconds while the child process is alive, and one terminal outcome: `agent.run.completed`, `agent.run.failed`, or `agent.run.aborted`.

Delivery failures do not interrupt the child command. The wrapper keeps at most 100 safe event envelopes in `.exceptalert-watchdog-spool/` and replays them on the next run. Relay de-duplicates AI Work Watchdog events by their stable `event_id`, so a replay is recorded once and later deliveries are acknowledged as duplicates. Keep automatic remediation disabled during dogfood.

## Demo controller

Create an **AI work deadline** controller for the configured AI Work Watchdog source. Choose a maximum duration longer than a normal job and schedule it every five minutes. It alerts only when a started run has neither a terminal event nor a recent wrapper heartbeat. Its response is to investigate the command and delivery path. Do not attach an automatic remediation action during dogfood.
