import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runControllerScheduler } from '@/lib/controller'

const CONTROLLER_SECRET_HEADER = 'x-controller-secret'

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.CONTROLLER_SECRET
  if (!configuredSecret) {
    return NextResponse.json({ error: 'Controller scheduler is not configured' }, { status: 503 })
  }

  const suppliedSecret = request.headers.get(CONTROLLER_SECRET_HEADER)
  if (!suppliedSecret || !safeEqual(suppliedSecret, configuredSecret)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const counts = await runControllerScheduler()
    return NextResponse.json({ ok: true, counts })
  } catch (err) {
    console.error('[controller] scheduler run failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}
