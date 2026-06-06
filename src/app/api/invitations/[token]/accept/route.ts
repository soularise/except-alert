import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { acceptInvitation } from '@/lib/tenancy'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await acceptInvitation(token, session.user.id, session.user.email)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  if (!result.tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  return NextResponse.json({ slug: result.tenant.slug })
}
