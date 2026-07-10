import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { actionTemplates, controllerJobActionBindings } from '@/lib/db/schema'
import { controllerEventCategory, type ControllerJobType } from '@/lib/controller-jobs'

type BindingDb = Pick<typeof db, 'select' | 'insert' | 'delete'>

export async function replaceControllerActionBindings(
  tx: BindingDb,
  tenantId: string,
  controllerJobId: string,
  type: ControllerJobType,
  templateIds: string[]
) {
  const uniqueIds = [...new Set(templateIds)]
  if (uniqueIds.length > 0) {
    const templates = await tx
      .select({ id: actionTemplates.id, category: actionTemplates.category })
      .from(actionTemplates)
      .where(and(eq(actionTemplates.tenantId, tenantId), inArray(actionTemplates.id, uniqueIds)))

    if (templates.length !== uniqueIds.length || templates.some((template: { category: string }) => template.category !== controllerEventCategory(type))) {
      throw new Error('invalid_controller_action_templates')
    }
  }

  await tx.delete(controllerJobActionBindings).where(eq(controllerJobActionBindings.controllerJobId, controllerJobId))
  if (uniqueIds.length > 0) {
    await tx.insert(controllerJobActionBindings).values(
      uniqueIds.map((actionTemplateId) => ({ controllerJobId, actionTemplateId }))
    )
  }
}

export async function controllerActionIdsByJob(tx: BindingDb, jobIds: string[]) {
  if (jobIds.length === 0) return new Map<string, string[]>()
  const rows = await tx
    .select({ controllerJobId: controllerJobActionBindings.controllerJobId, actionTemplateId: controllerJobActionBindings.actionTemplateId })
    .from(controllerJobActionBindings)
    .where(inArray(controllerJobActionBindings.controllerJobId, jobIds))
  const result = new Map<string, string[]>()
  for (const row of rows) {
    result.set(row.controllerJobId, [...(result.get(row.controllerJobId) ?? []), row.actionTemplateId])
  }
  return result
}
