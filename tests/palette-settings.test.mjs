import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('sidebar palette control is a dropdown with broad style names', () => {
  const palette = read('src/components/PaletteToggle.tsx')
  const layout = read('src/app/layout.tsx')
  const css = read('src/app/globals.css')

  assert.match(palette, /SelectTrigger/)
  assert.match(palette, /SelectItem/)
  assert.match(palette, /Classic/)
  assert.match(palette, /Signal/)
  assert.match(palette, /Terminal/)
  assert.doesNotMatch(palette, /Healthcare/)
  assert.doesNotMatch(palette, /Monitoring/)
  assert.match(palette, /value === 'monitoring'\) return 'signal'/)
  assert.match(layout, /p==='monitoring'\)p='signal'/)
  assert.match(css, /html\[data-palette='signal'\]/)
  assert.match(css, /html\[data-palette='terminal'\]/)
  assert.match(css, /--primary: oklch\(0\.78 0\.18 145\)/)
})
