import { and, count, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'

export async function getMonthlyExternalEventUsage(tenantId: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        sql`${events.hookId} LIKE 'hook_%'`,
        sql`${events.source} <> 'auth'`,
        sql`${events.category} <> 'test'`,
        sql`COALESCE(${events.tags}->>'test', 'false') <> 'true'`,
        sql`${events.receivedAt} >= date_trunc('month', now())`,
        sql`${events.receivedAt} < date_trunc('month', now()) + interval '1 month'`
      )
    )

  return result?.value ?? 0
}
