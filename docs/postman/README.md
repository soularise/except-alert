# ExceptAlert VPS logistics webhook tests

Import both JSON files in this directory into Postman, then select the `ExceptAlert VPS Logistics Webhooks` environment.

Set these environment values before running the collection:

| Variable | Value |
| --- | --- |
| `relay_base_url` | `https://relay.exceptalert.com` |
| `tenant_key` | The `org_...` ingress key in ExceptAlert Provider Settings, not the workspace name. |
| `tive_webhook_secret` | The test secret saved on the Tive provider configuration. |
| `sensos_webhook_secret` | The test secret saved on the Sensos provider configuration. |

Configure and save both providers in ExceptAlert before testing. The provider settings screen must show a public `https://relay.exceptalert.com/hook/...` URL. If it displays `http://relay:3800/...`, correct the VPS ExceptAlert `RELAY_URL` server environment and restart the app before continuing.

Run `Relay health`, then either vendor folder. The two `Delivery` requests use the same vendor-facing URL that Tive or Sensos would call. They assert only that Relay accepted the authenticated webhook. Each `Inspect normalization` request uses Relay's testing-only `/sync` endpoint to return and assert the normalized `exception.v1` payload. It also creates an event, so do not run both the delivery and inspection request if you want only one demo event.

The three rejection requests prove the authentication boundary: bad Tive signature, stale Tive signature, and bad Sensos token must return HTTP 401. They write audit records but do not create ExceptAlert events.

The Tive pre-request scripts use Postman's documented external-package syntax to load a pinned `crypto-js` version and generate the Base64 HMAC-SHA256 over the exact `timestamp.body` string. Do not alter a Tive request body after the pre-request script runs, because changing the bytes invalidates the signature.

After a successful delivery request, open the matching ExceptAlert event. It should be critical, show the logistics card, location facts, and a map pin. The collection uses derived Tive demo data, not a captured production webhook.
