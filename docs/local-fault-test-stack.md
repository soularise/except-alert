# Isolated Local Fault-Test Stack

This is a development-only stack for Relay and ExceptAlert fault testing. It is separate from the normal `except-alert` Compose project and must not be used for production, customer, employer, vendor, or Quick data.

## Boundary

Use the exact project name and file on every command:

```bash
docker compose -p er0050-fault -f docker-compose.fault-test.yml <command>
```

The default services are `postgres-fault` and `relay-fault`. They expose Postgres on `15432` and Relay on `13800`. Their database is `relay_fault`, and their named volumes are distinct from the existing `postgres_data` volume.

`exceptalert-fault` is excluded by default. It has no controller-ticker companion and must be requested explicitly with the `exceptalert` profile. ExceptAlert migrations are not applied automatically; authorize and apply them separately only if an app-level fault scenario requires them.

## Relay integration-test path

After the isolated services are running, host-run Relay integration tests target them with:

```bash
RELAY_TEST_BASE_URL=http://localhost:13800 \
RELAY_TEST_DATABASE_URL=postgres://relay:relay@localhost:15432/relay_fault \
cargo test --test tenant_ingestion_test unknown_provider_template -- --ignored
```

The tests seed and mutate only `relay_fault`. Capture the command output and resulting audit/event reconciliation as local evidence. A passing local test removes only the isolated-stack blocker for that validation path; it does not establish production, security, compliance, or broader product behavior.

## Isolated cleanup

After required evidence is retained, remove only this project and its named volumes:

```bash
docker compose -p er0050-fault -f docker-compose.fault-test.yml down --volumes --remove-orphans
```

Do not run cleanup against the existing `except-alert` project or its `postgres_data` volume.
