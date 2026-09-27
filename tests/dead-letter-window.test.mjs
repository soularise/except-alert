import test from 'node:test'
import assert from 'node:assert/strict'
import { deadLetterConfigSchema, deadLetterSilenceMs } from '../src/lib/controller-jobs.ts'

test('dead_letter accepts a minutes-based silence window', () => {
  const parsed = deadLetterConfigSchema.parse({ providerId: 'pi-watchdog', maximumSilenceMinutes: 5 })
  assert.equal(deadLetterSilenceMs(parsed), 5 * 60_000)
})

test('dead_letter keeps existing hours-based jobs working unchanged', () => {
  const parsed = deadLetterConfigSchema.parse({ providerId: 'stripe', maximumSilenceHours: 24 })
  assert.equal(deadLetterSilenceMs(parsed), 24 * 60 * 60_000)
})

test('dead_letter requires exactly one silence unit', () => {
  assert.equal(deadLetterConfigSchema.safeParse({ providerId: 'x' }).success, false)
  assert.equal(
    deadLetterConfigSchema.safeParse({ providerId: 'x', maximumSilenceHours: 1, maximumSilenceMinutes: 5 }).success,
    false
  )
})

test('dead_letter bounds the minutes window between 2 minutes and 30 days', () => {
  const accepts = (minutes) =>
    deadLetterConfigSchema.safeParse({ providerId: 'x', maximumSilenceMinutes: minutes }).success

  assert.equal(accepts(1), false)
  assert.equal(accepts(2), true)
  assert.equal(accepts(43_200), true)
  assert.equal(accepts(43_201), false)
  assert.equal(accepts(2.5), false)
})

test('dead_letter hours bounds are unchanged', () => {
  const accepts = (hours) => deadLetterConfigSchema.safeParse({ providerId: 'x', maximumSilenceHours: hours }).success

  assert.equal(accepts(0), false)
  assert.equal(accepts(1), true)
  assert.equal(accepts(720), true)
  assert.equal(accepts(721), false)
})
