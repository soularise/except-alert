export type ProviderDef = {
  id: string
  name: string
  icon: string
  description: string
  signatureHeader: string | null
  signatureAlgorithm: 'stripe' | 'hmac-sha256' | 'raw-sha256'
  signatureLabel: string
  docsUrl: string
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    icon: '🔒',
    description: 'Payment events, charge failures, disputes',
    signatureHeader: 'Stripe-Signature',
    signatureAlgorithm: 'stripe',
    signatureLabel: 'Stripe signed payload',
    docsUrl: 'https://stripe.com/docs/webhooks',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🔑',
    description: 'Workflow runs, secret alerts, Dependabot',
    signatureHeader: 'x-hub-signature-256',
    signatureAlgorithm: 'hmac-sha256',
    signatureLabel: 'HMAC-SHA256',
    docsUrl: 'https://docs.github.com/webhooks',
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    icon: '🚨',
    description: 'Incident lifecycle events',
    signatureHeader: 'x-pagerduty-signature',
    signatureAlgorithm: 'hmac-sha256',
    signatureLabel: 'HMAC-SHA256',
    docsUrl: 'https://developer.pagerduty.com/webhooks',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    icon: '📡',
    description: 'Error and crash report events',
    signatureHeader: 'sentry-hook-signature',
    signatureAlgorithm: 'hmac-sha256',
    signatureLabel: 'HMAC-SHA256',
    docsUrl: 'https://docs.sentry.io/webhooks',
  },
  {
    id: 'datadog',
    name: 'Datadog',
    icon: '📊',
    description: 'Metric alerts and monitor notifications',
    signatureHeader: 'x-datadog-signature',
    signatureAlgorithm: 'hmac-sha256',
    signatureLabel: 'HMAC-SHA256',
    docsUrl: 'https://docs.datadoghq.com/webhooks',
  },
  {
    id: 'facility-cms',
    name: 'Facility CMS',
    icon: '🏥',
    description: 'Nursing home rating/ownership changes',
    signatureHeader: 'x-relay-signature',
    signatureAlgorithm: 'hmac-sha256',
    signatureLabel: 'HMAC-SHA256',
    docsUrl: '',
  },
]
