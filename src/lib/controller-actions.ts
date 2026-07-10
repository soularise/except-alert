import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { actionTemplates, controllerJobActionBindings } from '@/lib/db/schema'
import { controllerEventCategory, type ControllerJobType } from '@/lib/controller-jobs'
import { executeAction } from '@/lib/hitl'

export async function dispatchControllerActions(
  tenantId: string,
  eventId: string,
  controllerJobId: string,
  type: ControllerJobType
) {
  const bindings = await db
    .select({ templateId: actionTemplates.id })
    .from(controllerJobActionBindings)
    .innerJoin(actionTemplates, eq(controllerJobActionBindings.actionTemplateId, actionTemplates.id))
    .where(and(
      eq(controllerJobActionBindings.controllerJobId, controllerJobId),
      eq(actionTemplates.tenantId, tenantId),
      eq(actionTemplates.category, controllerEventCategory(type))
    ))

  await Promise.allSettled(bindings.map(({ templateId }) =>
    executeAction(tenantId, eventId, templateId, 'automatic')
  ))
}
