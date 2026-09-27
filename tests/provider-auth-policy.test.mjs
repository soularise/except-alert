import test from 'node:test'
import assert from 'node:assert/strict'
import { PROVIDERS, allowsUnsigned, countsTowardProviderLimit } from '../src/lib/providers.ts'

const def = (id) => PROVIDERS.find((p) => p.id === id)

test('secret-optional catalog providers are exactly contact and supabase (Relay allowlist)', () => {
  const secretOptional = PROVIDERS.filter((p) => p.secretRequired === false).map((p) => p.id).sort()
  assert.deepEqual(secretOptional, ['contact', 'supabase'])
})

test('allowsUnsigned is true only for a secret-optional provider with a blank secret', () => {
  assert.equal(allowsUnsigned(def('supabase'), ''), true)
  assert.equal(allowsUnsigned(def('supabase'), '   '), true)
  assert.equal(allowsUnsigned(def('supabase'), 'whsec_real'), false)
  assert.equal(allowsUnsigned(def('contact'), ''), true)
  assert.equal(allowsUnsigned(def('stripe'), ''), false)
  assert.equal(allowsUnsigned(def('stripe'), 'whsec_real'), false)
  assert.equal(allowsUnsigned(def('pi-watchdog-m1'), ''), false)
})

test('contact is the only provider exempt from the provider limit', () => {
  const exempt = PROVIDERS.filter((p) => p.excludedFromProviderLimit === true).map((p) => p.id)
  assert.deepEqual(exempt, ['contact'])
  assert.equal(countsTowardProviderLimit('contact'), false)
})

test('hidden customer integrations still count toward the provider limit', () => {
  const hiddenIds = PROVIDERS.filter((p) => p.hidden).map((p) => p.id)
  assert.ok(hiddenIds.includes('pagerduty') && hiddenIds.includes('datadog') && hiddenIds.includes('facility-cms'))
  for (const id of ['pagerduty', 'datadog', 'facility-cms']) {
    assert.equal(countsTowardProviderLimit(id), true, id)
  }
})

test('visible integrations and unknown provider ids count toward the provider limit', () => {
  for (const id of ['stripe', 'github', 'supabase', 'pi-watchdog-m1', 'pi-watchdog-self']) {
    assert.equal(countsTowardProviderLimit(id), true, id)
  }
  assert.equal(countsTowardProviderLimit('not-in-catalog'), true)
})
