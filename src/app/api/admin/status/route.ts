import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isPlatformAdminEmail } from '@/lib/admin'

export async function GET(request: NextRequest) {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    return NextResponse.json({ isAdmin: false })
  }

  const session = await auth.api.getSession({ headers: request.headers })
  const isPlatformAdmin = isPlatformAdminEmail(session?.user.email)

  return NextResponse.json({
    isAdmin: isPlatformAdmin,
    isPlatformAdmin,
  })
}
