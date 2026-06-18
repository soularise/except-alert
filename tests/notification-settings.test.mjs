import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('notification settings include per-event Slack and Telegram toggles', () => {
  const route = read('src/app/api/[slug]/settings/route.ts')
  const page = read('src/app/(app)/[slug]/settings/page.tsx')

  assert.match(route, /slack_notify_on_event/)
  assert.match(route, /telegram_notify_on_event/)
  assert.match(route, /typeof val === 'boolean'/)
  assert.match(page, /Notify Slack for every new event/)
  assert.match(page, /Notify Telegram for every new event/)
  assert.match(page, /slack_notify_on_event: slackNotifyOnEvent/)
  assert.match(page, /telegram_notify_on_event: telegramNotifyOnEvent/)
})
