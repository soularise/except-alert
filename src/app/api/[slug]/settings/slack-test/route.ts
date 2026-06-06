import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { requireTenantAccess } from '@/lib/auth-guard'
import { sendSlackAlert } from '@/lib/slack'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const access = await requireTenantAccess(request, slug, 'admin')
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.tenantId, access.tenant.id), eq(settings.key, 'slack_webhook_url')))
      .limit(1)

    if (!row?.value) {
      return NextResponse.json({ error: 'No Slack webhook URL configured' }, { status: 400 })
    }

    await sendSlackAlert(row.value, 'ExceptAlert: Test message. Slack alerts are working.')
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
