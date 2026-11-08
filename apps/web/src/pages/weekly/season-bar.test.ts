import { describe, expect, it } from 'vitest'
import type { ActivitySeason } from '#core/adventure-guild/adventure-activity'
import { backfillProgress, seasonBar } from './season-bar'

const SEASON: ActivitySeason = {
  id: 9,
  name: '합성 시즌 9',
  startsAt: '2023-09-13T21:00:00.000Z',
  available: false
}

describe('backfillProgress', () => {
  it('받은 구간 수를 전체 구간 수로 나눈다', () => {
    expect(backfillProgress(12, 30)).toBe(0.4)
    expect(backfillProgress(30, 30)).toBe(1)
  })

  it('받을 구간이 없으면 0이다', () => {
    expect(backfillProgress(0, 0)).toBe(0)
  })

  it('받은 구간이 전체보다 많아도 1을 넘지 않는다', () => {
    expect(backfillProgress(31, 30)).toBe(1)
  })
})

describe('seasonBar', () => {
  it('고를 수 있는 시즌은 받기 상태가 있어도 다른 시즌과 같다', () => {
    expect(seasonBar({ ...SEASON, available: true })).toEqual({ state: 'ready' })
    expect(
      seasonBar({ ...SEASON, available: true, backfill: { done: 30, total: 30, running: false } })
    ).toEqual({ state: 'ready' })
  })

  it('받기 상태가 없는 고를 수 없는 시즌은 잠근다', () => {
    expect(seasonBar(SEASON)).toEqual({ state: 'locked' })
  })

  it('받는 중인 시즌은 진행률과 받는 중임을 준다', () => {
    expect(seasonBar({ ...SEASON, backfill: { done: 12, total: 30, running: true } })).toEqual({
      state: 'backfill',
      progress: 0.4,
      running: true
    })
  })

  it('받다 멈춘 시즌은 받은 만큼의 진행률을 그대로 두고 받는 중이 아니다', () => {
    expect(seasonBar({ ...SEASON, backfill: { done: 12, total: 30, running: false } })).toEqual({
      state: 'backfill',
      progress: 0.4,
      running: false
    })
  })
})
