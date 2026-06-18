import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('supabase is available as an optional-secret provider', () => {
  const providers = read('src/lib/providers.ts')
  const listRoute = read('src/app/api/[slug]/providers/route.ts')
  const detailRoute = read('src/app/api/[slug]/providers/[providerId]/route.ts')
  const page = read('src/app/(app)/[slug]/settings/providers/page.tsx')
  const relayUrl = read('src/lib/relay-url.ts')
  const supabaseBlock = providers.slice(
    providers.indexOf("id: 'supabase'"),
    providers.indexOf("id: 'pagerduty'")
  )

  assert.notEqual(supabaseBlock, '')
  assert.doesNotMatch(supabaseBlock, /hidden: true/)
  assert.match(supabaseBlock, /secretRequired: false/)
  assert.match(supabaseBlock, /supabase\.insert/)
  assert.match(supabaseBlock, /supabase\.update/)
  assert.match(supabaseBlock, /supabase\.delete/)
  assert.match(supabaseBlock, /https:\/\/supabase\.com\/docs\/guides\/database\/webhooks/)

  assert.match(listRoute, /secretRequired: p\.secretRequired \?\? true/)
  assert.match(listRoute, /resolveRelayUrl\(request\)/)
  assert.match(detailRoute, /resolveRelayUrl\(request\)/)
  assert.match(detailRoute, /secretRequired && !secret_key\.trim\(\) && !existing/)
  assert.match(relayUrl, /NODE_ENV === 'production'/)
  assert.match(relayUrl, /RELAY_URL is not configured/)
  assert.match(page, /provider\.secretRequired && !secretDraft\.trim\(\) && !provider\.configured/)
  assert.match(page, /webhookUrl: string \| null/)
  assert.match(page, /webhookUrlError: string \| null/)
})
