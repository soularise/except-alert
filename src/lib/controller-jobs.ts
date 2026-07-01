import { z } from 'zod'

export const CONTROLLER_JOB_TYPES = [
  'health_ping',
  'dead_letter',
  'cron_deadline',
  'deviation',
] as const

export type ControllerJobType = (typeof CONTROLLER_JOB_TYPES)[number]

export const CONTROLLER_JOB_STATUSES = ['pending', 'ok', 'alert', 'error'] as const

const providerId = z.string().trim().min(1).max(120)

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }, 'URL must use HTTP or HTTPS')
  .refine((value) => !new URL(value).username && !new URL(value).password, {
    message: 'URL must not include credentials',
  })

const boundedHours = z.number().int().min(1).max(24 * 30)
const boundedCron = z.string().trim().refine(isValidFiveFieldCron, {
  message: 'Cron expression must have five valid fields',
})
const timezone = z.string().trim().refine(isValidTimeZone, {
  message: 'Timezone must be a valid IANA timezone',
})

export const healthPingConfigSchema = z.object({
  url: httpUrl,
  timeoutMs: z.number().int().min(500).max(30_000),
  expectedStatus: z.number().int().min(100).max(599),
})

export const deadLetterConfigSchema = z.object({
  providerId,
  maximumSilenceHours: boundedHours,
})

export const cronDeadlineConfigSchema = z.object({
  providerId,
  minimumEvents: z.number().int().min(1).max(1_000_000),
  windowHours: boundedHours,
})

export const deviationConfigSchema = z.object({
  providerId,
  sigmaThreshold: z.number().min(1).max(10),
  baselineDays: z.number().int().min(2).max(90),
  direction: z.enum(['spike', 'drop', 'both']),
})

export const controllerJobConfigSchemas = {
  health_ping: healthPingConfigSchema,
  dead_letter: deadLetterConfigSchema,
  cron_deadline: cronDeadlineConfigSchema,
  deviation: deviationConfigSchema,
} as const

export const controllerJobWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(CONTROLLER_JOB_TYPES),
    config: z.unknown(),
    cronExpr: boundedCron.default('*/5 * * * *'),
    timezone: timezone.default('UTC'),
    enabled: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const parsed = controllerJobConfigSchemas[value.type].safeParse(value.config)
    if (parsed.success) return

    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ['config', ...issue.path],
      })
    }
  })

export type ControllerJobWrite = z.infer<typeof controllerJobWriteSchema>
export type HealthPingConfig = z.infer<typeof healthPingConfigSchema>
export type DeadLetterConfig = z.infer<typeof deadLetterConfigSchema>
export type CronDeadlineConfig = z.infer<typeof cronDeadlineConfigSchema>
export type DeviationConfig = z.infer<typeof deviationConfigSchema>

export function parseControllerJobWrite(input: unknown) {
  return controllerJobWriteSchema.parse(input)
}

export function providerIdForControllerJob(type: ControllerJobType, config: unknown) {
  if (type === 'health_ping') return null

  const parsed = controllerJobConfigSchemas[type].safeParse(config)
  if (!parsed.success) return null
  return parsed.data.providerId
}

export function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function isValidFiveFieldCron(value: string) {
  const fields = value.trim().split(/\s+/)
  if (fields.length !== 5) return false

  return (
    isValidCronField(fields[0], 0, 59) &&
    isValidCronField(fields[1], 0, 23) &&
    isValidCronField(fields[2], 1, 31) &&
    isValidCronField(fields[3], 1, 12) &&
    isValidCronField(fields[4], 0, 7)
  )
}

function isValidCronField(field: string, min: number, max: number) {
  return field.split(',').every((part) => isValidCronPart(part, min, max))
}

function isValidCronPart(part: string, min: number, max: number): boolean {
  const [rangePart, stepPart] = part.split('/')
  if (!rangePart || part.split('/').length > 2) return false
  if (stepPart && !isIntegerInRange(stepPart, 1, max)) return false
  if (rangePart === '*') return true

  const range = rangePart.split('-')
  if (range.length === 1) return isIntegerInRange(range[0], min, max)
  if (range.length !== 2) return false

  const [start, end] = range
  if (!isIntegerInRange(start, min, max) || !isIntegerInRange(end, min, max)) return false
  return Number(start) <= Number(end)
}

function isIntegerInRange(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value)) return false
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max
}
