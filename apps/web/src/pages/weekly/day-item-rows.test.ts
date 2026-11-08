import { expect, it } from 'vitest'
import type { ActivityDayItem } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { type DayItemRow, dayItemRows } from './day-item-rows'

function items(rarities: readonly string[]): ActivityDayItem[] {
  return rarities.map((rarity, index) => ({
    at: `2026-04-02T12:${String(index).padStart(2, '0')}:00+09:00`,
    name: `${rarity} ${index}`,
    rarity
  }))
}

function repeat(rarity: string, count: number): string[] {
  return Array.from({ length: count }, () => rarity)
}

function labels(rows: readonly DayItemRow[]): string[] {
  return rows.map((row) => {
    if (row.kind === 'item') {
      return row.item.name
    }

    return `${row.rarity} ${row.count}개`
  })
}

it('아이템이 8개 이하면 모든 아이템을 들어온 시간순으로 둔다', () => {
  const day = items(['레전더리', '태초', '에픽', '신화', ...repeat('레전더리', 4)])

  expect(dayItemRows(day)).toEqual(day.map((item) => ({ kind: 'item', item })))
})

it('8개를 넘으면 신화, 태초 순으로 이름을 두고 그 아래 에픽, 레전더리 개수를 둔다', () => {
  const day = items(['태초', '레전더리', '신화', '에픽', '태초', ...repeat('레전더리', 5)])

  expect(labels(dayItemRows(day))).toEqual([
    '신화 2',
    '태초 0',
    '태초 4',
    '에픽 1개',
    '레전더리 6개'
  ])
})

it('개수가 0인 등급은 줄을 두지 않는다', () => {
  expect(labels(dayItemRows(items(['태초', ...repeat('레전더리', 8)])))).toEqual([
    '태초 0',
    '레전더리 8개'
  ])
  expect(
    labels(dayItemRows(items([...repeat('에픽', 5), ...repeat('태초', 3), '신화', '태초'])))
  ).toEqual(['신화 8', '태초 5', '태초 6', '태초 7', '태초 9', '에픽 5개'])
})

it('이름 줄과 개수 줄이 8줄이면 그대로 두고, 9줄이면 모든 등급을 개수로 둔다', () => {
  const eight = items([...repeat('태초', 6), '에픽', '레전더리', '레전더리'])
  const nine = items([...repeat('태초', 6), '신화', '에픽', '레전더리', '레전더리'])

  expect(dayItemRows(eight)).toHaveLength(8)
  expect(labels(dayItemRows(eight)).slice(-2)).toEqual(['에픽 1개', '레전더리 2개'])
  expect(labels(dayItemRows(nine))).toEqual(['신화 1개', '태초 6개', '에픽 1개', '레전더리 2개'])
})

it('모두 개수로 둘 때도 0인 등급은 뺀다', () => {
  expect(labels(dayItemRows(items([...repeat('태초', 9), '레전더리'])))).toEqual([
    '태초 9개',
    '레전더리 1개'
  ])
})
