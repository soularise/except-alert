export type EventCategory = { value: string; label: string }

export type ProviderDef = {
  id: string
  name: string
  icon: string
  description: string
  signatureHeader: string | null
  signatureAlgorithm: 'stripe' | 'hmac-sha256' | 'raw-sha256'
  signatureLabel: string
  docsUrl: string
  eventCategories: EventCategory[]
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
    eventCategories: [
      { value: 'stripe.charge.failed', label: 'Charge Failed' },
      { value: 'stripe.charge.refunded', label: 'Charge Refunded' },
      { value: 'stripe.charge.dispute.created', label: 'Dispute Created' },
      { value: 'stripe.payment_intent.succeeded', label: 'Payment Succeeded' },
      { value: 'stripe.payment_intent.payment_failed', label: 'Payment Failed' },
      { value: 'stripe.invoice.payment_failed', label: 'Invoice Payment Failed' },
      { value: 'stripe.customer.subscription.deleted', label: 'Subscription Cancelled' },
      { value: 'stripe.radar.early_fraud_warning.created', label: 'Fraud Warning' },
    ],
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
    eventCategories: [
      { value: 'github.workflow_run', label: 'Workflow Run' },
    ],
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
    eventCategories: [
      { value: 'pagerduty.incident.triggered', label: 'Incident Triggered' },
      { value: 'pagerduty.incident.acknowledged', label: 'Incident Acknowledged' },
      { value: 'pagerduty.incident.resolved', label: 'Incident Resolved' },
      { value: 'pagerduty.incident.reassigned', label: 'Incident Reassigned' },
      { value: 'pagerduty.incident.escalated', label: 'Incident Escalated' },
    ],
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
    eventCategories: [
      { value: 'sentry.issue.created', label: 'Issue Created' },
      { value: 'sentry.issue.resolved', label: 'Issue Resolved' },
      { value: 'sentry.issue.assigned', label: 'Issue Assigned' },
      { value: 'sentry.issue.ignored', label: 'Issue Ignored' },
    ],
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
    eventCategories: [
      { value: 'datadog.alert', label: 'Monitor Alert' },
    ],
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
    eventCategories: [],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    icon: '▲',
    description: 'Deployment lifecycle events (success, error, cancel, promote)',
    signatureHeader: 'x-vercel-signature',
    signatureAlgorithm: 'hmac-sha256',
    signatureLabel: 'HMAC-SHA256',
    docsUrl: 'https://vercel.com/docs/deployments/webhooks',
    eventCategories: [
      { value: 'deployment.error', label: 'Deployment Error' },
      { value: 'deployment.canceled', label: 'Deployment Canceled' },
      { value: 'deployment.succeeded', label: 'Deployment Succeeded' },
      { value: 'deployment.created', label: 'Deployment Created' },
      { value: 'deployment.ready', label: 'Deployment Ready' },
      { value: 'deployment.promoted', label: 'Deployment Promoted' },
    ],
  },
]
