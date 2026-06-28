import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenantProviders } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { PROVIDERS } from '@/lib/providers'
import { resolveRelayUrl } from '@/lib/relay-url'
import { limitsFor } from '@/lib/plan-limits'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const relayUrl = resolveRelayUrl(request)

  try {
    const rows = await db
      .select()
      .from(tenantProviders)
      .where(eq(tenantProviders.tenantId, access.tenant.id))

    const configuredIds = new Set(rows.map((r) => r.providerId))

    const providers = PROVIDERS.filter((p) => !p.hidden).map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      description: p.description,
      signatureHeader: p.signatureHeader,
      signatureAlgorithm: p.signatureAlgorithm,
      signatureLabel: p.signatureLabel,
      secretRequired: p.secretRequired ?? true,
      secretLabel: p.secretLabel ?? 'Webhook Signing Secret',
      secretPlaceholder: p.secretPlaceholder ?? 'e.g. whsec_...',
      configHelp: p.configHelp ?? null,
      docsUrl: p.docsUrl,
      eventCategories: p.eventCategories,
      configured: configuredIds.has(p.id),
      webhookUrl: relayUrl.url ? `${relayUrl.url}/hook/${access.tenant.ingressKey}/${p.id}` : null,
      webhookUrlError: relayUrl.error,
    }))

    return NextResponse.json({
      providers,
      plan: access.tenant.plan,
      providerLimit: limitsFor(access.tenant.plan).providers,
      configuredProviderCount: rows.length,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
