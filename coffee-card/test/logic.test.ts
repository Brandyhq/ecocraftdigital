import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, rewardReady } from '../src/logic.ts'
import { issueSession, pinMatches, sessionValid } from '../src/auth.ts'

test('normalizePhone', () => {
  assert.equal(normalizePhone('050-123 4567'), '0501234567')
  assert.equal(normalizePhone('+972501234567'), '0501234567')
  assert.equal(normalizePhone('123'), null)
})
test('rewardReady', () => {
  assert.equal(rewardReady(9, 10), false)
  assert.equal(rewardReady(10, 10), true)
})
test('session + pin', async () => {
  assert.equal(await pinMatches('1234', '1234'), true)
  assert.equal(await pinMatches('1235', '1234'), false)
  const t = await issueSession('s')
  assert.equal(await sessionValid('s', t), true)
  assert.equal(await sessionValid('other', t), false)
  assert.equal(await sessionValid('s', await issueSession('s', -1000)), false)
  assert.equal(await sessionValid('s', undefined), false)
})
