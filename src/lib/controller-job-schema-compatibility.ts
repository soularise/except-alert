import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { CONTROLLER_JOB_TYPES, type ControllerJobType } from '@/lib/controller-jobs'

const AGENT_RUN_DEADLINE = 'agent_run_deadline' as const

export async function supportedControllerJobTypes(): Promise<ControllerJobType[]> {
  try {
    const [result] = await db.execute<{ agentRunDeadlineSupported: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'controller_jobs'::regclass
          AND conname = 'controller_jobs_type_check'
          AND pg_get_constraintdef(oid) LIKE '%agent_run_deadline%'
      ) AS "agentRunDeadlineSupported"
    `)

    if (result?.agentRunDeadlineSupported) return [...CONTROLLER_JOB_TYPES]
  } catch {
    // A failed introspection must not advertise a controller type the database
    // may reject. Existing types remain available through their prior contract.
  }

  return CONTROLLER_JOB_TYPES.filter((type) => type !== AGENT_RUN_DEADLINE)
}

export async function controllerJobTypeIsSchemaCompatible(type: ControllerJobType) {
  if (type !== AGENT_RUN_DEADLINE) return true
  return (await supportedControllerJobTypes()).includes(type)
}
