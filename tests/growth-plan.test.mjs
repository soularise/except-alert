import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { nextUpgradePlans } from '../src/lib/plan-limits.ts'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('next upgrade plans step up one plan at a time', () => {
  assert.deepEqual(nextUpgradePlans('free'), ['pro', 'growth'])
  assert.deepEqual(nextUpgradePlans('pro'), ['growth'])
  assert.deepEqual(nextUpgradePlans('growth'), [])
  assert.deepEqual(nextUpgradePlans(undefined), ['pro', 'growth'])
  assert.deepEqual(nextUpgradePlans('unknown'), ['pro', 'growth'])
})

test('upgrade button requests the next plan and hides on Growth', () => {
  const button = read('src/components/UpgradeRequestButton.tsx')

  assert.match(button, /currentPlan: string/)
  assert.match(button, /nextUpgradePlans\(currentPlan\)/)
  assert.match(button, /useState<UpgradePlan \| undefined>\(plans\[0\]\)/)
  assert.match(button, /if \(!requestedPlan \|\| plans\.length === 0\) return null/)
  assert.match(button, /`Request \$\{PLAN_LABELS\[requestedPlan\]\}`/)
  assert.match(button, /request sent/)
  assert.doesNotMatch(button, /requestedPlan = 'pro'/)
})

test('all upgrade call sites pass the current plan', () => {
  const sites = [
    'src/app/(app)/[slug]/settings/team/page.tsx',
    'src/app/(app)/[slug]/settings/providers/page.tsx',
    'src/app/(app)/[slug]/settings/controller-jobs/page.tsx',
    'src/app/(app)/[slug]/settings/account/page.tsx',
  ]

  for (const path of sites) {
    const source = read(path)
    for (const block of source.match(/<UpgradeRequestButton[\s\S]*?\/>/g) ?? []) {
      assert.match(block, /currentPlan=\{/, `${path} must pass currentPlan`)
    }
    assert.match(source, /<UpgradeRequestButton/, path)
  }

  assert.match(read(sites[0]), /Request Growth when you need more members/)
  assert.match(read(sites[1]), /tenant\.plan === 'pro' \? 'Growth' : 'Pro'/)
})

test('tenant upgrade route still rejects requests from Growth', () => {
  const route = read('src/app/api/[slug]/upgrade-requests/route.ts')
  assert.match(route, /access\.tenant\.plan === 'growth'/)
  assert.match(route, /status: 409/)
})

test('approving a request changes the plan to the requested plan', () => {
  const route = read('src/app/api/admin/upgrade-requests/[id]/route.ts')
  assert.match(route, /nextPlan: requestRow\.requestedPlan as Plan/)
})

test('account settings show the plan section for owners and admins', () => {
  const account = read('src/app/(app)/[slug]/settings/account/page.tsx')
  assert.match(account, /id="plan"/)
  assert.match(account, /role === 'owner' \|\| role === 'admin'/)
  assert.match(account, /Ask an owner or admin/)
  assert.match(account, /source="settings_plan"/)
})

test('sidebar usage meter links to the plan section near the limit', () => {
  const sidebar = read('src/components/AppSidebar.tsx')
  assert.match(sidebar, /nearLimit && nextPlans\.length > 0/)
  assert.match(sidebar, /settings\/account#plan/)
  assert.match(sidebar, /Request Growth/)
})

test('admin plan route is admin only, validates the plan and logs the change', () => {
  const route = read('src/app/api/admin/organizations/[id]/plan/route.ts')
  assert.match(route, /getAdminSession\(request\.headers\)/)
  assert.match(route, /status: 404/)
  assert.match(route, /z\.enum\(\['free', 'pro', 'growth'\]\)/)
  assert.match(route, /changeOrganizationPlan/)
  assert.match(route, /admin_plan_change/)
  assert.match(route, /slice\(0, 200\)/)
})

test('admin page renders the plan control for each organization', () => {
  const page = read('src/app/admin/page.tsx')
  const control = read('src/components/AdminOrganizationPlanControl.tsx')
  assert.match(page, /<AdminOrganizationPlanControl/)
  assert.match(control, /\/api\/admin\/organizations\/\$\{organizationId\}\/plan/)
  assert.match(control, /window\.confirm/)
  assert.match(control, /'free', 'pro', 'growth'/)
})
