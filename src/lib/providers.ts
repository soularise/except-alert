export type EventCategory = { value: string; label: string }

export type ProviderDef = {
  id: string
  name: string
  icon: string
  description: string
  signatureHeader: string | null
  signatureAlgorithm: 'stripe' | 'hmac-sha256' | 'raw-sha256'
  signatureLabel: string
  secretRequired?: boolean
  secretLabel?: string
  secretPlaceholder?: string
  configHelp?: string
  docsUrl: string
  eventCategories: EventCategory[]
  hidden?: boolean
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    icon: '💳',
    description: 'Subscription, checkout, payment, charge, and dispute events',
    signatureHeader: 'Stripe-Signature',
    signatureAlgorithm: 'stripe',
    signatureLabel: 'Stripe signed payload',
    docsUrl: 'https://stripe.com/docs/webhooks',
    eventCategories: [
      { value: 'stripe.checkout.session.completed', label: 'Checkout Completed' },
      { value: 'stripe.customer.subscription.created', label: 'Subscription Created' },
      { value: 'stripe.invoice.paid', label: 'Invoice Paid' },
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
    id: 'supabase',
    name: 'Supabase',
    icon: '⚡',
    description: 'Database row insert, update, and delete webhooks',
    signatureHeader: null,
    signatureAlgorithm: 'hmac-sha256',
    signatureLabel: 'Unsigned database webhook',
    secretRequired: false,
    secretLabel: 'Webhook Signing Secret (optional)',
    secretPlaceholder: 'Leave blank for Supabase Database Webhooks',
    configHelp:
      'Supabase Database Webhooks send JSON payloads without a built-in HMAC signature header. Save without a secret unless you add a compatible signing layer.',
    docsUrl: 'https://supabase.com/docs/guides/database/webhooks',
    eventCategories: [
      { value: 'supabase.insert', label: 'Row Inserted' },
      { value: 'supabase.update', label: 'Row Updated' },
      { value: 'supabase.delete', label: 'Row Deleted' },
    ],
  },
  {
    id: 'pagerduty',
    hidden: true,
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
    hidden: true,
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
    hidden: true,
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
    hidden: true,
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
  {
    id: 'contact',
    name: 'Contact Form',
    icon: '✉️',
    description: 'Landing page contact form inquiries',
    signatureHeader: null,
    signatureAlgorithm: 'hmac-sha256',
    signatureLabel: 'Unsigned public form',
    secretRequired: false,
    secretLabel: 'No secret needed (public form)',
    secretPlaceholder: '',
    docsUrl: '',
    eventCategories: [
      { value: 'contact.inquiry', label: 'Inquiry' },
    ],
  },
]
