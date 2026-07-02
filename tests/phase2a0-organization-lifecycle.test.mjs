import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('organization plan migration adds explicit entitlements and opaque ingress keys', () => {
  const migration = read('drizzle/migrations/0007_organizations_and_plans.sql')
  const planChangeMigration = read('drizzle/migrations/0012_tenant_plan_changes.sql')
  const schema = read('src/lib/db/schema.ts')

  assert.match(migration, /ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'/)
  assert.match(migration, /CHECK \(plan IN \('free', 'pro', 'growth'\)\)/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS ingress_key TEXT/)
  assert.match(migration, /tenants_ingress_key_unique/)
  assert.match(planChangeMigration, /CREATE TABLE IF NOT EXISTS tenant_plan_changes/)
  assert.match(planChangeMigration, /previous_plan TEXT NOT NULL/)
  assert.match(planChangeMigration, /next_plan\s+TEXT NOT NULL/)
  assert.match(schema, /plan:\s+text\('plan'\)\.notNull\(\)\.default\('free'\)/)
  assert.match(schema, /ingressKey:\s+text\('ingress_key'\)\.notNull\(\)/)
  assert.match(schema, /export const tenantPlanChanges = pgTable/)
})

test('signup creates identity only and setup uses the organization lifecycle service', () => {
  const auth = read('src/lib/auth.ts')
  const setup = read('src/app/api/setup/tenant/route.ts')
  const lifecycle = read('src/lib/organization-lifecycle.ts')

  assert.doesNotMatch(auth, /databaseHooks/)
  assert.doesNotMatch(auth, /createTenantForUser/)
  assert.match(setup, /isPlatformAdminEmail\(session\.user\.email\) \? 'growth' : 'free'/)
  assert.match(setup, /createSelfServeFreeOrganization\(session\.user\.id, name\.trim\(\), plan\)/)
  assert.match(setup, /OrganizationLifecycleError/)
  assert.match(lifecycle, /pg_advisory_xact_lock/)
  assert.match(lifecycle, /createdByUserId: input\.selfServe \? input\.userId : null/)
  assert.match(lifecycle, /export async function changeOrganizationPlan/)
  assert.match(lifecycle, /tenantPlanChanges/)
})

test('providers and invitations enforce plan limits server-side', () => {
  const planLimits = read('src/lib/plan-limits.ts')
  const providerRoute = read('src/app/api/[slug]/providers/[providerId]/route.ts')
  const inviteRoute = read('src/app/api/[slug]/team/invitations/route.ts')

  assert.match(planLimits, /free:[\s\S]*members: 1/)
  assert.match(planLimits, /free:[\s\S]*providers: 1/)
  assert.match(providerRoute, /canConfigureProvider\(access\.tenant\.plan, configuredProviders\)/)
  assert.match(providerRoute, /pg_advisory_xact_lock/)
  assert.match(inviteRoute, /canInviteMember\(access\.tenant\.plan, occupiedSeats\)/)
  assert.match(inviteRoute, /pg_advisory_xact_lock/)
  assert.match(inviteRoute, /isNull\(tenantInvitations\.acceptedAt\)/)
})

test('provider webhook URLs use the opaque organization ingress key', () => {
  const listRoute = read('src/app/api/[slug]/providers/route.ts')
  const detailRoute = read('src/app/api/[slug]/providers/[providerId]/route.ts')

  assert.match(listRoute, /access\.tenant\.ingressKey/)
  assert.match(detailRoute, /access\.tenant\.ingressKey/)
  assert.doesNotMatch(listRoute, /hook\/\$\{slug\}/)
  assert.doesNotMatch(detailRoute, /hook\/\$\{slug\}/)
})

test('authenticated layout exposes an organization switcher', () => {
  const layout = read('src/app/(app)/[slug]/layout.tsx')
  const tenancy = read('src/lib/tenancy.ts')
  const sidebar = read('src/components/AppSidebar.tsx')

  assert.match(tenancy, /export async function getTenantsForUser/)
  assert.match(layout, /getTenantsForUser\(session\.user\.id\)/)
  assert.match(layout, /organizations=\{organizations\}/)
  assert.match(sidebar, /organizations\.length > 1/)
  assert.match(sidebar, /router\.push\(`\/\$\{nextSlug\}\/dashboard`\)/)
})

test('setup and public signup preserve invite-safe bootstrap behavior', () => {
  const setup = read('src/app/setup/page.tsx')
  const setupClient = read('src/app/setup/SetupClient.tsx')
  const signup = read('src/app/signup/page.tsx')
  const signupClient = read('src/app/signup/SignupClient.tsx')

  assert.match(setup, /redirect\(`\/login\$\{suffix\}`\)/)
  assert.match(setup, /safeReturnTo\?\.startsWith\('\/invite\/'\)/)
  assert.match(setup, /getFirstTenantForUser\(session\.user\.id\)/)
  assert.match(setupClient, /Create your Free organization/)
  assert.match(setupClient, /Create Free organization/)
  assert.match(signup, /safeReturnTo\?\.startsWith\('\/invite\/'\)/)
  assert.match(signup, /redirect\(safeReturnTo\)/)
  assert.match(signupClient, /authClient\.signUp\.email/)
  assert.match(signupClient, /returnTo \?\? '\/setup'/)
})

test('public signup and setup have persistent abuse controls', () => {
  const migration = read('drizzle/migrations/0011_abuse_rate_limits.sql')
  const authRoute = read('src/app/api/auth/[...all]/route.ts')
  const setupRoute = read('src/app/api/setup/tenant/route.ts')
  const limiter = read('src/lib/rate-limit.ts')

  assert.match(migration, /CREATE TABLE IF NOT EXISTS abuse_rate_limits/)
  assert.match(limiter, /ON CONFLICT \(key, window_start\)/)
  assert.match(limiter, /createHash\('sha256'\)/)
  assert.match(limiter, /EXCEPTALERT_TRUST_PROXY_HEADERS/)
  assert.match(limiter, /cf-connecting-ip/)
  assert.match(authRoute, /isSignupEmailRequest/)
  assert.match(authRoute, /auth_signup_ip/)
  assert.match(authRoute, /auth_signup_email/)
  assert.match(authRoute, /missing-or-invalid-email/)
  assert.match(setupRoute, /setup_tenant_ip/)
  assert.match(setupRoute, /setup_tenant_user/)
})

test('invitation acceptance requires a verified account and locked token use', () => {
  const tenancy = read('src/lib/tenancy.ts')

  assert.match(tenancy, /pg_advisory_xact_lock\(hashtext\(\$\{token\}\), 2\)/)
  assert.match(tenancy, /authUser\.emailVerified/)
  assert.match(tenancy, /Verify your email address before accepting this invitation/)
})
