import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('dashboard source and category filters support partial, case-insensitive searches', () => {
  const route = read('src/app/api/[slug]/events/route.ts')

  assert.match(route, /ilike\(events\.source, containsPattern\(source\)\)/)
  assert.match(route, /ilike\(events\.category, containsPattern\(category\)\)/)
  assert.match(route, /function containsPattern\(value: string\)/)
})

test('dashboard text filters wait briefly before updating the URL', () => {
  const filterBar = read('src/components/FilterBar.tsx')

  assert.match(filterBar, /window\.setTimeout\(\(\) => \{/) 
  assert.match(filterBar, /\}, 300\)/)
  assert.match(filterBar, /setSourceInput\(e\.target\.value\)/)
  assert.match(filterBar, /setCategoryInput\(e\.target\.value\)/)
})

test('dashboard filter changes do not give sibling components the same React key', () => {
  const dashboardClient = read('src/components/DashboardClient.tsx')

  assert.match(dashboardClient, /<FilterBar key=\{`filters-\$\{filtersKey\}`\}/)
  assert.match(dashboardClient, /key=\{`events-\$\{filtersKey\}`\}/)
})
