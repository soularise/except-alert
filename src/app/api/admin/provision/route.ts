import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/admin'
import { ProvisioningError, provisionCustomer } from '@/lib/admin-provisioning'

const provisionSchema = z.object({
  customerEmail: z.email(),
  customerName: z.string().trim().min(1),
  organizationName: z.string().trim().optional(),
  slugOverride: z.string().trim().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getAdminSession(request.headers)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = provisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid provisioning details' }, { status: 400 })
  }

  try {
    const result = await provisionCustomer({
      ...parsed.data,
      adminUserId: session.user.id,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ProvisioningError) {
      const status = err.code === 'duplicate_email' || err.code === 'duplicate_slug' ? 409 : 400
      return NextResponse.json({ error: err.message }, { status })
    }

    console.error('[admin provision] failed to provision customer:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
