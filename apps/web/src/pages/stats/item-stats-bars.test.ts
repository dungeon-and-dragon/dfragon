// @vitest-environment jsdom
import { expect, it } from 'vitest'
import type { ItemStats } from '#entities/ranking'
import { skillLevelChart } from './item-stats-bars'

const item = (name: string, count: number) => ({ itemId: name, name, typeDetail: null, count })

// 합성 통계다. 이름 끝 [NLv] 표기만 게임 응답과 같다.
const stats: ItemStats = {
  computedAt: '2026-11-29T00:00:00.000Z',
  sampleSize: 200,
  slots: [
    {
      slotId: 'TITLE',
      items: [
        item('합성 칭호', 50),
        item('합성 칭호 플래티넘[80Lv]', 30),
        item('다른 합성 칭호[80Lv]', 10),
        item('합성 칭호 플래티넘[30Lv]', 20)
      ]
    },
    { slotId: 'CREATURE', items: [item('합성 크리쳐[100Lv]', 4), item('합성 크리쳐', 90)] },
    { slotId: 'RING', items: [item('합성 반지[45Lv]', 9)] }
  ]
}

const series = [
  { slotId: 'TITLE', name: '칭호', color: 'title-color' },
  { slotId: 'CREATURE', name: '크리쳐', color: 'creature-color' },
  { slotId: 'WEAPON_AVATAR', name: '무기 아바타', color: 'avatar-color' }
]

it('고른 부위들의 이름 끝 Lv을 아이템과 상관없이 합쳐 Lv 오름차순으로 두고, 부위마다 표본 대비 비율을 낸다', () => {
  const chart = skillLevelChart(stats, series)

  expect(chart.x.map(({ title, tick }) => [title, tick])).toEqual([
    ['30Lv', '30'],
    ['80Lv', '80'],
    ['100Lv', '100']
  ])
  expect(chart.bars).toEqual([
    { key: 'TITLE', name: '칭호', color: 'title-color', values: [10, 20, 0] },
    { key: 'CREATURE', name: '크리쳐', color: 'creature-color', values: [0, 0, 2] },
    { key: 'WEAPON_AVATAR', name: '무기 아바타', color: 'avatar-color', values: [0, 0, 0] }
  ])
})

it('Lv이 붙은 아이템이 없으면 x축과 값이 비어 있다', () => {
  const chart = skillLevelChart({ ...stats, slots: [] }, series)

  expect(chart.x).toEqual([])
  expect(chart.bars.map(({ values }) => values)).toEqual([[], [], []])
})
