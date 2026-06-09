UPDATE tenant_providers
SET signature_algorithm = 'stripe',
    signature_header = 'Stripe-Signature'
WHERE provider_id = 'stripe'
  AND (signature_algorithm IS NULL OR signature_algorithm <> 'stripe');

UPDATE tenant_providers
SET signature_algorithm = 'hmac-sha256'
WHERE provider_id IN ('github', 'sentry', 'datadog', 'pagerduty', 'facility-cms')
  AND (signature_algorithm IS NULL OR signature_algorithm <> 'hmac-sha256');

UPDATE tenant_providers
SET signature_header = 'x-pagerduty-signature'
WHERE provider_id = 'pagerduty'
  AND signature_header IS DISTINCT FROM 'x-pagerduty-signature';

UPDATE tenant_providers
SET signature_header = 'x-relay-signature'
WHERE provider_id = 'facility-cms'
  AND signature_header IS DISTINCT FROM 'x-relay-signature';
