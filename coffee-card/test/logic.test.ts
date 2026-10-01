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

import { birthdayAvailable, csvCell, parseBirthday, stampMultiplier, toCsv } from '../src/logic.ts'

test('parseBirthday', () => {
  assert.equal(parseBirthday('7', '21'), '07-21')
  assert.equal(parseBirthday('2', '29'), '02-29')
  assert.equal(parseBirthday('2', '30'), null)
  assert.equal(parseBirthday('13', '1'), null)
})
test('stampMultiplier uses Israel weekday', () => {
  const tue = new Date('2026-10-06T10:00:00Z') // Tuesday
  assert.equal(stampMultiplier('2', tue), 2)
  assert.equal(stampMultiplier('3', tue), 1)
  assert.equal(stampMultiplier('', tue), 1)
  // Mon 22:30 UTC is already Tue 01:30 in Israel (UTC+3, DST)
  assert.equal(stampMultiplier('2', new Date('2026-10-05T22:30:00Z')), 2)
})
test('birthdayAvailable', () => {
  const now = new Date('2026-07-25T10:00:00Z')
  const base = { birthday: '07-21', birthday_reward_year: null, created_at: '2026-06-01 10:00:00' }
  assert.equal(birthdayAvailable(base, now), true)
  assert.equal(birthdayAvailable({ ...base, birthday_reward_year: 2026 }, now), false)
  assert.equal(birthdayAvailable({ ...base, birthday_reward_year: 2025 }, now), true)
  assert.equal(birthdayAvailable({ ...base, birthday: '08-01' }, now), false)
  assert.equal(birthdayAvailable({ ...base, birthday: null }, now), false)
  assert.equal(birthdayAvailable({ ...base, created_at: '2026-07-22 10:00:00' }, now), false) // card too new
})
test('csv escapes quotes and formulas', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""')
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell(null), '')
  assert.ok(toCsv([['שם']]).startsWith('﻿'))
})
