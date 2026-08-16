# ER-0022 Sensos Temperature Excursion Proof

Import `sensos-temperature-excursion-proof.postman_collection.json` and `sensos-temperature-excursion-proof.postman_environment.json`, then set `relay_base_url`, the `org_...` tenant ingress key, and the configured `sensos_webhook_secret`.

Run the accepted request once, then the duplicate request without changing `sensos_alert_id`. The first must return `processed`; the second must return `duplicate`. The unsupported `HumidityBreach` request must return `failed` with no normalized category, and the invalid-token request must return HTTP 401.

After accepted delivery, inspect the ExceptAlert event detail for source `sensos`, category `sensos.temperature_excursion`, critical severity, vendor alert, shipment, temperature/range, condition, location, normalized payload, and audit trail. The fixture is a published-reference or demo-derived local artifact, not a captured production payload. This proves only the narrow Sensos `TemperatureBreach` slice and does not claim broad Sensos or SenseAware support.
