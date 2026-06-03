import { NextRequest, NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { baselines } from '@/lib/db/schema'

export async function GET() {
  try {
    const rows = await db.select().from(baselines).orderBy(desc(baselines.createdAt))
    return NextResponse.json({ baselines: rows })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { category, threshold, window_minutes } = body as {
    category?: unknown
    threshold?: unknown
    window_minutes?: unknown
  }

  if (typeof category !== 'string' || !category.trim()) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }
  if (typeof threshold !== 'number' || threshold < 1) {
    return NextResponse.json({ error: 'threshold must be a positive number' }, { status: 400 })
  }
  if (typeof window_minutes !== 'number' || window_minutes < 1) {
    return NextResponse.json({ error: 'window_minutes must be a positive number' }, { status: 400 })
  }

  try {
    const [created] = await db
      .insert(baselines)
      .values({ category, threshold, windowMinutes: window_minutes })
      .returning()
    return NextResponse.json({ baseline: created }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
