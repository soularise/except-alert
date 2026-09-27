import test from 'node:test'
import assert from 'node:assert/strict'
import { PROVIDERS } from '../src/lib/providers.ts'

for (const id of ['pi-watchdog-self', 'pi-watchdog-m1']) {
  test(`${id} is a selectable, secret-required HMAC source`, () => {
    const provider = PROVIDERS.find((p) => p.id === id)

    assert.ok(provider, `${id} missing from provider catalog`)
    assert.notEqual(provider.hidden, true)
    assert.notEqual(provider.secretRequired, false)
    assert.equal(provider.signatureHeader, 'x-pi-watchdog-signature')
    assert.equal(provider.signatureAlgorithm, 'hmac-sha256')
  })
}

test('LAN watchdog categories match the Relay templates', () => {
  const categories = (id) => PROVIDERS.find((p) => p.id === id)?.eventCategories.map((c) => c.value)

  assert.deepEqual(categories('pi-watchdog-self'), ['infra.observer.heartbeat'])
  assert.deepEqual(categories('pi-watchdog-m1'), ['infra.host.heartbeat'])
})
