import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { normalizeAppPalette } from '@/lib/app-palette'

export async function GET(request: NextRequest) {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    return NextResponse.json({ palette: 'classic' })
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user] = await db
    .select({ appPalette: authUser.appPalette })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1)

  return NextResponse.json({ palette: normalizeAppPalette(user?.appPalette) })
}

export async function PATCH(request: NextRequest) {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    return NextResponse.json({ palette: 'classic' })
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const palette = normalizeAppPalette((body as { palette?: unknown }).palette as string | undefined)
  await db
    .update(authUser)
    .set({ appPalette: palette, updatedAt: new Date() })
    .where(eq(authUser.id, session.user.id))

  return NextResponse.json({ palette })
}
