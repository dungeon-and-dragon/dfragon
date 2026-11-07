import assert from 'node:assert/strict'
import test from 'node:test'
import { latestRefreshStart, msUntilNextRefresh } from '../src/skill-style-collection/schedule.js'

const MINUTE_MS = 60_000
const WEEK_MS = 7 * 24 * 60 * MINUTE_MS
// 2026-11-05(목) 01:00 KST는 2026-11-04 16:00 UTC다.
const thursdayStart = new Date('2026-11-04T16:00:00Z')
const previousThursdayStart = new Date('2026-10-28T16:00:00Z')

test('목요일 01:00(KST) 정각에는 그 시각이 회차 시작이고 다음 회차는 한 주 뒤다', () => {
  assert.deepEqual(latestRefreshStart(thursdayStart), thursdayStart)
  assert.equal(msUntilNextRefresh(thursdayStart), WEEK_MS)
})

test('목요일 00:59(KST)는 지난주 목요일 회차에 속하고 다음 회차까지 1분 남는다', () => {
  const beforeStart = new Date(thursdayStart.getTime() - MINUTE_MS)

  assert.deepEqual(latestRefreshStart(beforeStart), previousThursdayStart)
  assert.equal(msUntilNextRefresh(beforeStart), MINUTE_MS)
})

test('한 주 가운데의 시각은 그 전 목요일 01:00(KST) 회차에 속한다', () => {
  // 2026-11-09(월) 12:00 KST
  const monday = new Date('2026-11-09T03:00:00Z')

  assert.deepEqual(latestRefreshStart(monday), thursdayStart)
  // 다음 회차는 2026-11-12(목) 01:00 KST로 2일 13시간 뒤다.
  assert.equal(msUntilNextRefresh(monday), (2 * 24 + 13) * 60 * MINUTE_MS)
})
