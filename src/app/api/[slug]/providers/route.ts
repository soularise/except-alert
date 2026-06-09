import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenantProviders } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { PROVIDERS } from '@/lib/providers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const relayUrl = process.env.RELAY_URL ?? 'http://localhost:3800'

  try {
    const rows = await db
      .select()
      .from(tenantProviders)
      .where(eq(tenantProviders.tenantId, access.tenant.id))

    const configuredIds = new Set(rows.map((r) => r.providerId))

    const providers = PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      description: p.description,
      signatureHeader: p.signatureHeader,
      signatureAlgorithm: p.signatureAlgorithm,
      signatureLabel: p.signatureLabel,
      docsUrl: p.docsUrl,
      configured: configuredIds.has(p.id),
      webhookUrl: `${relayUrl}/hook/${slug}/${p.id}`,
    }))

    return NextResponse.json({ providers })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
