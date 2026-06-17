import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('baselines page explains alert threshold semantics', () => {
  const source = read('src/app/(app)/[slug]/baselines/page.tsx')

  assert.match(source, /How baseline alerts work/)
  assert.match(source, /greater than this number/)
  assert.match(source, /threshold of <code>0<\/code> alerts on the first matching event/)
  assert.match(source, /<code>1<\/code> alerts on the second/)
  assert.match(source, /<code>5<\/code> alerts on the sixth/)
  assert.match(source, /min=\{0\}/)
  assert.match(source, /cools down for the same length as its/)
})

test('baseline validation allows zero thresholds', () => {
  const createRoute = read('src/app/api/[slug]/baselines/route.ts')
  const updateRoute = read('src/app/api/[slug]/baselines/[id]/route.ts')
  const evaluator = read('src/lib/baselines.ts')

  assert.match(createRoute, /threshold < 0/)
  assert.match(createRoute, /threshold must be zero or a positive number/)
  assert.match(updateRoute, /threshold >= 0/)
  assert.match(evaluator, /eventCount <= baseline\.threshold/)
})
