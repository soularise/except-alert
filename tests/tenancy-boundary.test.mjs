import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    const stat = statSync(path)
    return stat.isDirectory() ? walk(path) : [path]
  })
}

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('legacy unscoped app data routes are not present', () => {
  const forbidden = [
    'src/app/api/events/route.ts',
    'src/app/api/baselines/route.ts',
    'src/app/api/templates/route.ts',
    'src/app/api/settings/route.ts',
    'src/app/dashboard/page.tsx',
  ]

  const allFiles = new Set(walk(join(root, 'src/app')).map((path) => path.slice(root.length)))
  for (const path of forbidden) {
    assert.equal(allFiles.has(path), false, `${path} must not be reintroduced`)
  }
})

test('tenant app UI does not call legacy unscoped data APIs', () => {
  const files = walk(join(root, 'src'))
    .filter((path) => /\.(tsx?|jsx?)$/.test(path))
    .filter((path) => !path.includes('/src/app/api/auth/'))
    .filter((path) => !path.includes('/src/app/api/setup/tenant/'))
    .filter((path) => !path.includes('/src/app/api/invitations/'))

  const forbidden = [
    /\/api\/events\b/,
    /\/api\/baselines\b/,
    /\/api\/templates\b/,
    /\/api\/settings\b/,
    /href=["']\/dashboard\b/,
    /router\.push\(["']\/dashboard\b/,
    /redirect\(["']\/dashboard\b/,
  ]

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${file.slice(root.length)} matched ${pattern}`)
    }
  }
})

test('tenant data API routes require tenant access', () => {
  const routeFiles = walk(join(root, 'src/app/api/[slug]'))
    .filter((path) => path.endsWith('/route.ts'))

  assert.ok(routeFiles.length > 0, 'expected tenant API route files')

  for (const file of routeFiles) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /requireTenantAccess\(/, `${file.slice(root.length)} must call requireTenantAccess`)
  }
})

test('critical tenant queries include tenant filters', () => {
  const expectations = new Map([
    ['src/app/api/[slug]/events/route.ts', /eq\(events\.tenantId, access\.tenant\.id\)/],
    ['src/app/api/[slug]/events/[id]/route.ts', /eq\(events\.tenantId, access\.tenant\.id\)/],
    ['src/app/api/[slug]/baselines/route.ts', /eq\(baselines\.tenantId, access\.tenant\.id\)/],
    ['src/app/api/[slug]/templates/route.ts', /eq\(actionTemplates\.tenantId, access\.tenant\.id\)/],
    ['src/app/api/[slug]/settings/route.ts', /eq\(settings\.tenantId, access\.tenant\.id\)/],
    ['src/lib/hitl.ts', /eq\(actionTemplates\.tenantId, tenantId\)/],
    ['src/lib/baselines.ts', /eq\(events\.tenantId, tenantId\)/],
  ])

  for (const [file, pattern] of expectations) {
    assert.match(read(file), pattern, `${file} is missing expected tenant filter`)
  }
})
