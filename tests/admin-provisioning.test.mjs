import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('admin provisioning route is gated by admin session', () => {
  const route = read('src/app/api/admin/provision/route.ts')
  assert.match(route, /getAdminSession\(request\.headers\)/)
  assert.match(route, /status: 404/)
})

test('admin provisioning is discoverable to configured admins', () => {
  const admin = read('src/lib/admin.ts')
  assert.match(admin, /hello@exceptalert\.com/)
  assert.match(admin, /droidsafari@gmail\.com/)
  assert.match(admin, /isPlatformAdminEmail/)

  const sidebar = read('src/components/AppSidebar.tsx')
  assert.match(sidebar, /\/api\/admin\/status/)
  assert.match(sidebar, /\/admin\/provision/)
  assert.match(sidebar, /isPlatformAdmin/)
  assert.match(sidebar, /Platform/)
  assert.match(sidebar, /Provision/)
})

test('sidebar shows the current signed-in user identity', () => {
  const sidebar = read('src/components/AppSidebar.tsx')
  assert.match(sidebar, /authClient\.useSession\(\)/)
  assert.match(sidebar, /session\?\.user\.name/)
  assert.match(sidebar, /session\?\.user\.email/)
  assert.match(sidebar, /truncate text-sm font-medium/)
})

test('tenant admin role does not grant platform provisioning', () => {
  const statusRoute = read('src/app/api/admin/status/route.ts')
  assert.match(statusRoute, /isPlatformAdminEmail\(session\?\.user\.email\)/)
  assert.doesNotMatch(statusRoute, /tenantMemberships/)
  assert.doesNotMatch(statusRoute, /getTenantMembership/)
  assert.doesNotMatch(statusRoute, /requireTenantAccess/)

  const provisionPage = read('src/app/admin/provision/page.tsx')
  assert.match(provisionPage, /isPlatformAdminEmail\(session\.user\.email\)/)

  const provisionRoute = read('src/app/api/admin/provision/route.ts')
  assert.match(provisionRoute, /getAdminSession\(request\.headers\)/)
  assert.doesNotMatch(provisionRoute, /requireTenantAccess/)
})

test('admin provisioning creates a credential account with a temporary password', () => {
  const source = read('src/lib/admin-provisioning.ts')
  assert.match(source, /hashPassword\(tempPassword\)/)
  assert.match(source, /providerId: 'credential'/)
  assert.match(source, /role: 'owner'/)
  assert.match(source, /plan: 'pro'/)
  assert.match(source, /ingressKey: createIngressKey\(\)/)
})

test('public Free signup is enabled while admin provisioning remains paid-path', () => {
  const auth = read('src/lib/auth.ts')
  assert.match(auth, /disableSignUp:\s*false/)

  const login = read('src/app/login/page.tsx')
  assert.match(login, /\/signup/)
  assert.match(login, /Start Free/)

  const signup = read('src/app/signup/page.tsx')
  const signupClient = read('src/app/signup/SignupClient.tsx')
  assert.match(signup, /getFirstTenantForUser\(session\.user\.id\)/)
  assert.match(signup, /redirect\('\/setup'\)/)
  assert.match(signupClient, /authClient\.signUp\.email/)
  assert.match(signupClient, /window\.location\.assign\(returnTo \?\? '\/setup'\)/)
})

test('admin provisioning instructions do not use forgot password onboarding', () => {
  const client = read('src/app/admin/provision/ProvisionClient.tsx')
  assert.match(client, /Temporary password/)
  assert.match(client, /Settings - Account/)
  assert.doesNotMatch(client, /Forgot password/i)
})

test('local development trusts localhost and 127.0.0.1 origins', () => {
  assert.match(read('next.config.ts'), /allowedDevOrigins:\s*\["127\.0\.0\.1"\]/)

  const auth = read('src/lib/auth.ts')
  assert.match(auth, /http:\/\/localhost:3000/)
  assert.match(auth, /http:\/\/127\.0\.0\.1:3000/)
  assert.match(auth, /trustedOrigins:/)
})
