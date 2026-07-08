import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('tenant help page explains setup, core concepts, and upgrades', () => {
  const help = read('src/app/(app)/[slug]/help/page.tsx')

  assert.match(help, /PageHeader title="Help"/)
  assert.match(help, /Getting started/)
  assert.match(help, /First run/)
  assert.match(help, /Core concepts/)
  assert.match(help, /Sources/)
  assert.match(help, /Events/)
  assert.match(help, /Alert rules/)
  assert.match(help, /Actions/)
  assert.match(help, /Controllers/)
  assert.match(help, /How upgrades work/)
  assert.match(help, /payment instructions/)
  assert.match(help, /platform admin marks the request paid and approves it/)
  assert.doesNotMatch(help, /Relay raw payload/i)
})

test('help is discoverable from the sidebar and empty dashboard setup', () => {
  const sidebar = read('src/components/AppSidebar.tsx')
  const dashboard = read('src/components/DashboardClient.tsx')

  assert.match(sidebar, /CircleHelp/)
  assert.match(sidebar, /label: 'Help'/)
  assert.match(sidebar, /href: `\$\{base\}\/help`/)
  assert.match(dashboard, /Getting started/)
  assert.match(dashboard, /href={`\/\$\{tenant\.slug\}\/help`}/)
})

test('upgrade request affordance explains manual payment process', () => {
  const button = read('src/components/UpgradeRequestButton.tsx')

  assert.match(button, /Upgrades are reviewed manually/)
  assert.match(button, /send payment details before changing your plan/)
  assert.match(button, /Upgrade request sent\. We will follow up with payment details\./)
})
