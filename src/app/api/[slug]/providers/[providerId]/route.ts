import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenantProviders } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { PROVIDERS } from '@/lib/providers'

type Params = { params: Promise<{ slug: string; providerId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { slug, providerId } = await params
  const access = await requireTenantAccess(request, slug, 'viewer')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providerDef = PROVIDERS.find((p) => p.id === providerId && !p.hidden)
  if (!providerDef) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  const relayUrl = process.env.RELAY_URL ?? (() => {
    const proto = request.headers.get('x-forwarded-proto') ?? 'http'
    const hostHeader = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost'
    const hostname = hostHeader.split(':')[0]
    return `${proto}://${hostname}:3800`
  })()

  try {
    const [row] = await db
      .select()
      .from(tenantProviders)
      .where(
        and(
          eq(tenantProviders.tenantId, access.tenant.id),
          eq(tenantProviders.providerId, providerId)
        )
      )
      .limit(1)

    return NextResponse.json({
      ...providerDef,
      secretRequired: providerDef.secretRequired ?? true,
      secretLabel: providerDef.secretLabel ?? 'Webhook Signing Secret',
      secretPlaceholder: providerDef.secretPlaceholder ?? 'e.g. whsec_...',
      configHelp: providerDef.configHelp ?? null,
      configured: !!row,
      secretKey: row ? '••••••••••' : null,
      webhookUrl: `${relayUrl}/hook/${slug}/${providerId}`,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { slug, providerId } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providerDef = PROVIDERS.find((p) => p.id === providerId && !p.hidden)
  if (!providerDef) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { secret_key } = body as { secret_key?: unknown }
  const secretRequired = providerDef.secretRequired ?? true

  try {
    const [existing] = await db
      .select()
      .from(tenantProviders)
      .where(
        and(
          eq(tenantProviders.tenantId, access.tenant.id),
          eq(tenantProviders.providerId, providerId)
        )
      )
      .limit(1)

    if (typeof secret_key !== 'string') {
      return NextResponse.json({ error: 'secret_key must be a string' }, { status: 400 })
    }

    if (secretRequired && !secret_key.trim() && !existing) {
      return NextResponse.json({ error: 'secret_key is required' }, { status: 400 })
    }

    const nextSecret = secret_key.trim() || existing?.secretKey || ''

    await db
      .insert(tenantProviders)
      .values({
        tenantId: access.tenant.id,
        providerId,
        secretKey: nextSecret,
        signatureHeader: providerDef.signatureHeader,
        signatureAlgorithm: providerDef.signatureAlgorithm,
        config: {},
      })
      .onConflictDoUpdate({
        target: [tenantProviders.tenantId, tenantProviders.providerId],
        set: {
          secretKey: nextSecret,
          signatureHeader: providerDef.signatureHeader,
          signatureAlgorithm: providerDef.signatureAlgorithm,
        },
      })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug, providerId } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providerDef = PROVIDERS.find((p) => p.id === providerId && !p.hidden)
  if (!providerDef) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  try {
    await db
      .delete(tenantProviders)
      .where(
        and(
          eq(tenantProviders.tenantId, access.tenant.id),
          eq(tenantProviders.providerId, providerId)
        )
      )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
