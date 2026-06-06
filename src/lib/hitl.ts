import { db } from '@/lib/db'
import { events, actionTemplates, actions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { sameTenant } from '@/lib/tenant-access'

type EventRow = typeof events.$inferSelect

function renderTemplate(template: string, event: EventRow): string {
  return template
    .replace(/\{\{source\}\}/g, event.source)
    .replace(/\{\{severity\}\}/g, event.severity)
    .replace(/\{\{title\}\}/g, event.title)
    .replace(/\{\{category\}\}/g, event.category)
    .replace(/\{\{hook_id\}\}/g, event.hookId)
    .replace(/\{\{tags\.(\w+)\}\}/g, (_, key) => String((event.tags as Record<string, unknown>)?.[key] ?? ''))
}

export async function executeAction(
  tenantId: string,
  eventId: string,
  templateId: string
): Promise<{ success: boolean; actionId: string; alreadyExecuted: boolean; error?: string }> {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
    .limit(1)
  if (!event) throw new Error('Event not found')

  const [template] = await db
    .select()
    .from(actionTemplates)
    .where(and(eq(actionTemplates.id, templateId), eq(actionTemplates.tenantId, tenantId)))
    .limit(1)
  if (!template) throw new Error('Template not found')
  if (!sameTenant(event.tenantId, template.tenantId)) throw new Error('Template not found')

  const idempotencyKey = `${eventId}:${templateId}`

  const [existing] = await db
    .select()
    .from(actions)
    .where(and(eq(actions.idempotencyKey, idempotencyKey), eq(actions.status, 'executed')))
    .limit(1)

  if (existing) {
    return { success: true, actionId: existing.id, alreadyExecuted: true }
  }

  const config = template.config as {
    url: string
    method: string
    headers?: Record<string, string> | null
    payload_template?: string | null
  }

  let renderedBody: string
  let parsedBody: unknown
  if (config.payload_template) {
    renderedBody = renderTemplate(config.payload_template, event)
    try {
      parsedBody = JSON.parse(renderedBody)
    } catch {
      parsedBody = renderedBody
    }
  } else {
    parsedBody = {}
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let actionStatus: string
  let errorInfo: unknown = null
  let executedAt: Date | null = null

  try {
    const res = await fetch(config.url, {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers ?? {}),
      },
      body: JSON.stringify(parsedBody),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      actionStatus = 'executed'
      executedAt = new Date()
    } else {
      actionStatus = 'failed'
      let body: unknown
      try {
        body = await res.json()
      } catch {
        body = await res.text()
      }
      errorInfo = { statusCode: res.status, body }
    }
  } catch (err) {
    clearTimeout(timeout)
    actionStatus = 'failed'
    errorInfo = { message: err instanceof Error ? err.message : String(err) }
  }

  const [inserted] = await db
    .insert(actions)
    .values({
      tenantId: event.tenantId,
      eventId,
      templateId,
      label: template.label,
      configSnapshot: template.config,
      idempotencyKey,
      status: actionStatus,
      errorInfo: errorInfo as never,
      executedAt,
    })
    .returning()

  if (actionStatus === 'executed') {
    await db
      .update(events)
      .set({ status: 'acknowledged' })
      .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId), eq(events.status, 'open')))
  }

  return {
    success: actionStatus === 'executed',
    actionId: inserted.id,
    alreadyExecuted: false,
    ...(actionStatus === 'failed' ? { error: JSON.stringify(errorInfo) } : {}),
  }
}
