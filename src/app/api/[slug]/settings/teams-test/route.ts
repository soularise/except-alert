import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { sendTeamsAlert } from '@/lib/teams'
import { canUseChannel } from '@/lib/plan-limits'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUseChannel(access.tenant.plan, 'teams')) {
    return NextResponse.json(
      { error: 'Microsoft Teams delivery requires Pro or Growth' },
      { status: 403 }
    )
  }

  try {
    let webhookUrl: string | null = null

    const body = await request.json().catch(() => ({}))
    if (typeof body?.teams_webhook_url === 'string' && body.teams_webhook_url.trim()) {
      webhookUrl = body.teams_webhook_url.trim()
    } else {
      const [row] = await db
        .select()
        .from(settings)
        .where(and(eq(settings.tenantId, access.tenant.id), eq(settings.key, 'teams_webhook_url')))
        .limit(1)
      webhookUrl = row?.value ?? null
    }

    if (!webhookUrl) {
      return NextResponse.json({ error: 'No Microsoft Teams webhook URL configured' }, { status: 400 })
    }

    await sendTeamsAlert(webhookUrl, 'ExceptAlert: Test message. Microsoft Teams alerts are working.')
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
