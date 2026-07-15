import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname
const read = (path) => readFileSync(join(root, path), 'utf8')

test('logistics events render reusable shipment context and a map fallback', () => {
  const detail = read('src/components/EventDetail.tsx')
  const context = read('src/components/LogisticsContext.tsx')
  const map = read('src/components/LogisticsMap.tsx')

  assert.match(detail, /LogisticsContext tags=\{event\.tags\}/)
  assert.match(context, /tags\.logistics/)
  assert.match(context, /Location unavailable for this event/)
  assert.match(context, /Open in Google Maps/)
  assert.match(context, /tags\.logistics/)
  assert.match(map, /MapContainer/)
  assert.match(map, /OpenStreetMap/)
  assert.match(map, /CircleMarker/)
})

test('Tive and Sensos are available as logistics webhook sources', () => {
  const providers = read('src/lib/providers.ts')
  const tive = providers.slice(providers.indexOf("id: 'tive'"), providers.indexOf("id: 'sensos'"))
  const sensos = providers.slice(providers.indexOf("id: 'sensos'"), providers.indexOf("id: 'pagerduty'"))

  assert.match(tive, /signatureAlgorithm: 'tive'/)
  assert.match(tive, /x-tive-signature/)
  assert.match(tive, /tive\.temperature_excursion/)
  assert.match(sensos, /signatureAlgorithm: 'header-token'/)
  assert.match(sensos, /x-relay-token/)
  assert.match(sensos, /sensos\.temperature_excursion/)
})
