import {
  bigserial,
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

const timestamptz = (name: string) => timestamp(name, { withTimezone: true })

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  hookId: text('hook_id').notNull(),
  source: text('source').notNull(),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  tags: jsonb('tags').default({}),
  payload: jsonb('payload').notNull(),
  occurredAt: timestamptz('occurred_at').notNull(),
  receivedAt: timestamptz('received_at').notNull().defaultNow(),
  status: text('status').default('open'),
})

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  hookId: text('hook_id').notNull(),
  providerId: text('provider_id').notNull(),
  rawPayload: jsonb('raw_payload').notNull(),
  normalized: jsonb('normalized'),
  schemaName: text('schema_name'),
  mappingName: text('mapping_name'),
  status: text('status').notNull().default('received'),
  errorInfo: jsonb('error_info'),
  receivedAt: timestamptz('received_at').notNull().defaultNow(),
  processedAt: timestamptz('processed_at'),
  deliveredAt: timestamptz('delivered_at'),
})

export const schemas = pgTable('schemas', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  schemaDef: jsonb('schema_def').notNull(),
  createdAt: timestamptz('created_at').defaultNow(),
})

export const mappings = pgTable('mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: text('provider_id').notNull(),
  schemaId: uuid('schema_id').references(() => schemas.id),
  mappingDef: jsonb('mapping_def').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamptz('created_at').defaultNow(),
})

export const actionTemplates = pgTable('action_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  label: text('label').notNull(),
  actionType: text('action_type').notNull().default('webhook'),
  config: jsonb('config').notNull(),
  createdAt: timestamptz('created_at').defaultNow(),
})

export const actions = pgTable('actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id),
  templateId: uuid('template_id')
    .notNull()
    .references(() => actionTemplates.id),
  label: text('label').notNull(),
  configSnapshot: jsonb('config_snapshot').notNull(),
  idempotencyKey: text('idempotency_key').unique(),
  status: text('status').default('pending'),
  errorInfo: jsonb('error_info'),
  executedAt: timestamptz('executed_at'),
  createdAt: timestamptz('created_at').defaultNow(),
})
