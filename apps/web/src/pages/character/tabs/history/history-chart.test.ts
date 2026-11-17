import { describe, expect, it } from 'vitest'
import { historyTimeAxis } from './history-chart'

describe('historyTimeAxis', () => {
  it('열이틀 동안의 이력은 한국 시간 날짜 경계로 축을 넓히고 사흘 간격 날짜를 축 글자로 둔다', () => {
    const times = ['2026-11-05T22:00:00+09:00', '2026-11-17T22:09:00+09:00'].map(Date.parse)

    const positions = historyTimeAxis(times)

    expect(positions.min).toBe(Date.parse('2026-11-05T00:00:00+09:00'))
    expect(positions.max).toBe(Date.parse('2026-11-18T00:00:00+09:00'))
    expect(positions.ticks.map(({ label }) => label)).toEqual(['11-06', '11-09', '11-12', '11-15'])
  })

  it('하루 안의 이력은 시각 간격으로 축 글자를 둔다', () => {
    const times = ['2026-11-17T09:20:00+09:00', '2026-11-17T13:40:00+09:00'].map(Date.parse)

    const positions = historyTimeAxis(times)

    expect(positions.min).toBe(Date.parse('2026-11-17T09:00:00+09:00'))
    expect(positions.max).toBe(Date.parse('2026-11-17T14:00:00+09:00'))
    expect(positions.ticks.map(({ label }) => label)).toEqual(['10:00', '11:00', '12:00', '13:00'])
  })
})
