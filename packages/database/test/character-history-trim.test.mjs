import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findLoweredHistoryIntervals } from '../dist/character-history-trim.js'

const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }
const nextEngine = { ...engine, bundleId: 'phase33-rev15a' }
const at = (day) => new Date(`2026-11-${day}T22:00:00+09:00`)
const basicOf = (day, fame) => ({ observedAt: at(day), lastSeenAt: at(day), fame })
const scoreOf = (day, score, scoreEngine = engine) => ({
  observedAt: at(day),
  kind: 'equipment',
  score,
  engine: scoreEngine,
  approximate: null
})

test('명성이 낮아졌다 돌아오면 낮아진 시각부터 돌아온 시각 전까지가 구간이고, 그 안에서 조금 올라도 직전 기록보다 낮으면 같은 구간이다', () => {
  const intervals = findLoweredHistoryIntervals({
    basics: [
      basicOf(10, 127471),
      basicOf(12, 13100),
      basicOf(13, 111742),
      basicOf(15, 127471),
      basicOf(17, 128000)
    ],
    scores: [scoreOf(10, 490770), scoreOf(12, 0), scoreOf(13, 50436), scoreOf(15, 490770)]
  })

  assert.deepEqual(intervals, [{ from: at(12), until: at(15) }])
})

test('끝까지 낮은 채면 구간의 끝이 없다', () => {
  const intervals = findLoweredHistoryIntervals({
    basics: [basicOf(10, 127471), basicOf(12, 112100)],
    scores: []
  })

  assert.deepEqual(intervals, [{ from: at(12), until: null }])
})

test('명성이 그대로여도 같은 엔진 버전의 점수가 낮아진 동안은 구간이고, 점수 행이 없는 시각은 직전 점수로 본다', () => {
  const intervals = findLoweredHistoryIntervals({
    basics: [basicOf(10, 127471), basicOf(13, 127500), basicOf(15, 127600)],
    scores: [scoreOf(10, 490770), scoreOf(12, 480000), scoreOf(15, 491000)]
  })

  assert.deepEqual(intervals, [{ from: at(12), until: at(15) }])
})

test('엔진 버전이 바뀐 점수는 낮아도 구간이 아니고, 명성이 빠진 행과도 비교하지 않는다', () => {
  const intervals = findLoweredHistoryIntervals({
    basics: [basicOf(10, 127471), basicOf(12, null), basicOf(13, 100000)],
    scores: [scoreOf(10, 490770), scoreOf(12, 470000, nextEngine)]
  })

  assert.deepEqual(intervals, [])
})
