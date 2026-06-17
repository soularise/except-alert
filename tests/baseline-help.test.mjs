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
  assert.match(source, /threshold of <code>1<\/code> alerts on the second matching event/)
  assert.match(source, /cools down for the same length as its/)
})
