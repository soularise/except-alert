import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname
const read = (path) => readFileSync(join(root, path), 'utf8')

test('domain-pack catalog keeps workflow packs separate from provider proof', () => {
  const catalog = read('src/lib/domain-packs.ts')

  for (const packId of [
    'logistics_ops',
    'engineering_ops',
    'app_saas_ops',
    'data_platform_ops',
    'agent_ops',
  ]) {
    assert.match(catalog, new RegExp(`id: '${packId}'`))
  }

  assert.match(catalog, /availability: 'available'/)
  assert.match(catalog, /proofStatus: 'locally_verified'/)
  assert.match(catalog, /availability: 'planned'/)
  assert.match(catalog, /providerId: 'tive'/)
  assert.match(catalog, /normalizedEvent: 'tive\.temperature_excursion'/)
  assert.match(catalog, /providerId: 'samsara'/)
  assert.match(catalog, /normalizedEvent: 'samsara\.vehicle\.fault_detected'/)
  assert.match(catalog, /Representative Alert Webhooks 2\.0 payload still required/)
  assert.match(catalog, /providerId: 'sensos'/)
  assert.match(catalog, /normalizedEvent: 'sensos\.temperature_excursion'/)
  assert.match(catalog, /Not production verified\./)
})

test('Settings Domain Packs renders the status model without a new stateful API or action', () => {
  const component = read('src/components/DomainPackStatus.tsx')
  const providersPage = read('src/app/(app)/[slug]/settings/providers/page.tsx')
  const domainPacksPage = read('src/app/(app)/[slug]/settings/domain-packs/page.tsx')
  const settingsLayout = read('src/app/(app)/[slug]/settings/layout.tsx')
  const sidebar = read('src/components/AppSidebar.tsx')

  assert.doesNotMatch(providersPage, /DomainPackStatus/)
  assert.match(domainPacksPage, /import \{ DomainPackStatus \} from '@\/components\/DomainPackStatus'/)
  assert.match(domainPacksPage, /<DomainPackStatus \/>/)
  assert.match(settingsLayout, /domain-packs/)
  assert.match(settingsLayout, /'Domain Packs'/)
  assert.match(sidebar, /label: 'Domain Packs'/)
  assert.match(sidebar, /settings\/domain-packs/)
  assert.match(component, /Read-only catalog status/)
  assert.match(component, /Configuring a source does not verify its provider event contract/)
  assert.doesNotMatch(component, /\bfetch\(/)
  assert.doesNotMatch(component, /onClick=/)
})
