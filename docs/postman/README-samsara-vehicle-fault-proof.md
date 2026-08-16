# ER-0020 Samsara vehicle-fault proof

Import the `samsara-vehicle-fault-proof` collection and environment. Set `relay_base_url`, the configured Relay `tenant_key`, and the Base64 `samsara_webhook_secret`. The collection records the timestamp, signature, and repeatable `eventId` variables.

This is a synthetic/local proof based on ER-0019 research and Samsara's documented Webhooks 1.0 Fault Codes shape. It is not production-grade Samsara support. Production readiness requires a sanitized representative Alert Webhooks 2.0 payload.

Run the signed accepted request once, then run the duplicate request without changing `samsara_event_id` to prove duplicate handling. The unsupported request is independently signed and must return a `failed` sync response with no normalized category. The invalid-signature request must return HTTP 401. After an accepted request, open the ExceptAlert event detail and verify source, category, warning severity, Vehicle, Event ID, Fault evidence, raw-versus-normalized payload, and audit entry.
