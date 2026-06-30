import {
  bigserial,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// Helper matching the existing pattern in the codebase
const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true })

// ─── Better Auth tables (TEXT ids, owned by Better Auth) ──────────────────────

export const authUser = pgTable('user', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image:         text('image'),
  appPalette:    text('app_palette').notNull().default('classic'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
})

export const authSession = pgTable('session', {
  id:          text('id').primaryKey(),
  expiresAt:   timestamp('expires_at').notNull(),
  token:       text('token').notNull().unique(),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  ipAddress:   text('ip_address'),
  userAgent:   text('user_agent'),
  userId:      text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
})

export const authAccount = pgTable('account', {
  id:                    text('id').primaryKey(),
  accountId:             text('account_id').notNull(),
  providerId:            text('provider_id').notNull(),
  userId:                text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  accessToken:           text('access_token'),
  refreshToken:          text('refresh_token'),
  idToken:               text('id_token'),
  accessTokenExpiresAt:  timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope:                 text('scope'),
  password:              text('password'),
  createdAt:             timestamp('created_at').notNull().defaultNow(),
  updatedAt:             timestamp('updated_at').notNull().defaultNow(),
})

export const authVerification = pgTable('verification', {
  id:         text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value:      text('value').notNull(),
  expiresAt:  timestamp('expires_at').notNull(),
  createdAt:  timestamp('created_at'),
  updatedAt:  timestamp('updated_at'),
})

// ─── Tenant tables ────────────────────────────────────────────────────────────

export const tenants = pgTable(
  'tenants',
  {
    id:                    uuid('id').primaryKey().defaultRandom(),
    name:                  text('name').notNull(),
    slug:                  text('slug').notNull().unique(),
    plan:                  text('plan').notNull().default('free'),
    config:                jsonb('config').default({}),
    createdByUserId:       text('created_by_user_id').references(() => authUser.id),
    onboardingCompletedAt: timestamptz('onboarding_completed_at'),
    ingressKey:            text('ingress_key').notNull(),
    createdAt:             timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tenants_ingress_key_unique').on(t.ingressKey)]
)

export const tenantMemberships = pgTable('tenant_memberships', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    text('user_id').notNull(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role:      text('role').notNull().default('member'),
  invitedBy: text('invited_by'),
  joinedAt:  timestamptz('joined_at').notNull().defaultNow(),
})

export const tenantInvitations = pgTable('tenant_invitations', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email:      text('email').notNull(),
  role:       text('role').notNull().default('member'),
  token:      text('token').notNull().unique(),
  invitedBy:  text('invited_by').notNull(),
  expiresAt:  timestamptz('expires_at').notNull(),
  acceptedAt: timestamptz('accepted_at'),
  createdAt:  timestamptz('created_at').notNull().defaultNow(),
})

// ─── Relay-owned tables (read-only from ExceptAlert's perspective) ─────────────

export const auditLog = pgTable('audit_log', {
  id:          bigserial('id', { mode: 'number' }).primaryKey(),
  hookId:      text('hook_id').notNull(),
  providerId:  text('provider_id').notNull(),
  rawPayload:  jsonb('raw_payload').notNull(),
  normalized:  jsonb('normalized'),
  schemaName:  text('schema_name'),
  mappingName: text('mapping_name'),
  status:      text('status').notNull().default('received'),
  errorInfo:   jsonb('error_info'),
  receivedAt:  timestamptz('received_at').notNull().defaultNow(),
  processedAt: timestamptz('processed_at'),
  deliveredAt: timestamptz('delivered_at'),
})

export const schemas = pgTable('schemas', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  version:   text('version').notNull(),
  schemaDef: jsonb('schema_def').notNull(),
  createdAt: timestamptz('created_at').defaultNow(),
})

export const mappings = pgTable('mappings', {
  id:         uuid('id').primaryKey().defaultRandom(),
  providerId: text('provider_id').notNull(),
  schemaId:   uuid('schema_id').references(() => schemas.id),
  mappingDef: jsonb('mapping_def').notNull(),
  isActive:   boolean('is_active').default(true),
  createdAt:  timestamptz('created_at').defaultNow(),
})

// ─── ExceptAlert-owned data tables ────────────────────────────────────────────

export const events = pgTable('events', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  hookId:      text('hook_id').notNull(),
  source:      text('source').notNull(),
  severity:    text('severity').notNull(),
  title:       text('title').notNull(),
  description: text('description'),
  category:    text('category').notNull(),
  tags:        jsonb('tags').default({}),
  payload:     jsonb('payload').notNull(),
  occurredAt:  timestamptz('occurred_at').notNull(),
  receivedAt:  timestamptz('received_at').notNull().defaultNow(),
  status:      text('status').default('open'),
})

export const actionTemplates = pgTable('action_templates', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id),
  category:   text('category').notNull(),
  label:      text('label').notNull(),
  actionType: text('action_type').notNull().default('webhook'),
  config:     jsonb('config').notNull(),
  createdAt:  timestamptz('created_at').defaultNow(),
})

export const actions = pgTable('actions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  eventId:        uuid('event_id').notNull().references(() => events.id),
  templateId:     uuid('template_id').notNull().references(() => actionTemplates.id),
  label:          text('label').notNull(),
  configSnapshot: jsonb('config_snapshot').notNull(),
  idempotencyKey: text('idempotency_key').unique(),
  status:         text('status').default('pending'),
  errorInfo:      jsonb('error_info'),
  executedAt:     timestamptz('executed_at'),
  createdAt:      timestamptz('created_at').defaultNow(),
})

export const baselines = pgTable('baselines', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id),
  category:      text('category').notNull(),
  threshold:     integer('threshold').notNull(),
  windowMinutes: integer('window_minutes').notNull(),
  lastAlertedAt: timestamptz('last_alerted_at'),
  createdAt:     timestamptz('created_at').notNull().defaultNow(),
})

export const settings = pgTable(
  'settings',
  {
    tenantId:  uuid('tenant_id').notNull().references(() => tenants.id),
    key:       text('key').notNull(),
    value:     text('value').notNull(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })]
)

// Owned by Relay (created in Relay migration 003_tenant_aware_ingestion.sql).
// ExceptAlert writes to it via the Provider Settings UI; Relay reads from it
// for per-tenant signature verification during webhook ingestion.
export const tenantProviders = pgTable('tenant_providers', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  providerId:         text('provider_id').notNull(),
  secretKey:          text('secret_key'),
  signatureHeader:    text('signature_header'),
  signatureAlgorithm: text('signature_algorithm'),
  config:             jsonb('config').default({}),
  createdAt:          timestamptz('created_at').notNull().defaultNow(),
})
