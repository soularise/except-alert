import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileCode2,
  Gauge,
  PlugZap,
  ShieldAlert,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface HelpPageProps {
  params: Promise<{ slug: string }>
}

const setupSteps = [
  {
    title: 'Create a source',
    description:
      'Choose the system that will send webhooks, save its source, and copy the generated ingest URL.',
  },
  {
    title: 'Send a test event',
    description:
      'Use the source test action first. Test events confirm the connection without counting toward monthly usage.',
  },
  {
    title: 'Watch incoming events',
    description:
      'New external events appear on the Events screen with severity, category, source, and status.',
  },
  {
    title: 'Add alert rules and actions',
    description:
      'Alert rules watch for unusual activity. Actions define the controlled follow-up steps your team can run.',
  },
]

const concepts = [
  {
    icon: PlugZap,
    title: 'Sources',
    description:
      'A source is a configured webhook connection from a service such as Stripe, GitHub, PagerDuty, or Supabase.',
  },
  {
    icon: ShieldAlert,
    title: 'Events',
    description:
      'Events are normalized alerts from your sources. They can be open, acknowledged, resolved, or dismissed.',
  },
  {
    icon: Gauge,
    title: 'Alert rules',
    description:
      'Alert rules help surface spikes and unusual patterns so the dashboard is not only a raw event list.',
  },
  {
    icon: FileCode2,
    title: 'Actions',
    description:
      'Actions are reusable response steps attached to events, such as drafting a reply or running a controlled workflow.',
  },
  {
    icon: Activity,
    title: 'Controllers',
    description:
      'Controllers run scheduled checks. Paid plans can use them to automate monitoring beyond direct webhooks.',
  },
]

const upgradeSteps = [
  'An owner or admin sends an upgrade request from a limit message.',
  'ExceptAlert reviews the request and sends payment instructions.',
  'After payment, the platform admin marks the request paid and approves it.',
  'The workspace plan changes immediately after approval.',
]

export default async function HelpPage({ params }: HelpPageProps) {
  const { slug } = await params

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Help" />
      <main className="space-y-6 px-4 py-6 sm:px-6">
        <section className="max-w-3xl space-y-2">
          <p className="text-sm font-medium text-primary">Getting started</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Monitor product events without digging through raw webhook data.
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            ExceptAlert receives events from your tools, turns them into a shared event
            queue, and gives your team a place to review, triage, and respond.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/${slug}/settings/providers`}
              className={buttonVariants({ variant: 'default', size: 'sm' })}
            >
              <PlugZap data-icon="inline-start" />
              Configure source
            </Link>
            <Link
              href={`/${slug}/dashboard`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Events
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">First run</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {setupSteps.map((step, index) => (
              <Card key={step.title} className="rounded-lg">
                <CardHeader>
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Core concepts</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {concepts.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="rounded-lg">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <CardTitle>{title}</CardTitle>
                  </div>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <CardTitle>How upgrades work</CardTitle>
              </div>
              <CardDescription>
                Paid plans are manually approved while ExceptAlert is in this early operating mode.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {upgradeSteps.map((step) => (
                  <li key={step} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Plans</CardTitle>
              <CardDescription>
                Free workspaces are for validation. Pro and Growth workspaces unlock more usage,
                sources, members, and automation as your monitoring footprint grows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Use Free to connect one source and confirm events are flowing.</p>
              <p>Request Pro or Growth when you need more sources, team capacity, or controllers.</p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
