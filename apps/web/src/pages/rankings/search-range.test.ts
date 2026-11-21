import { expect, it } from 'vitest'
import { criterionFilterOf, rangeOfFilter, searchRangeOf } from './search-range'

it('두 칸의 정수를 범위로 읽고, 빈 칸은 그쪽 끝을 두지 않으며 앞뒤 공백은 버린다', () => {
  expect(searchRangeOf('136000', '138000')).toEqual({ from: 136000, to: 138000 })
  expect(searchRangeOf(' 136000 ', '')).toEqual({ from: 136000 })
  expect(searchRangeOf('', '0')).toEqual({ to: 0 })
  expect(searchRangeOf('', '999999999')).toEqual({ to: 999999999 })
  expect(searchRangeOf('138000', '138000')).toEqual({ from: 138000, to: 138000 })
  expect(searchRangeOf('', '  ')).toEqual({})
})

it.each([
  ['쉼표', '136,000', ''],
  ['음수', '-1', ''],
  ['소수', '', '1.5'],
  ['0으로 시작하는 수', '0136000', ''],
  ['10자리 이상', '', '1000000000'],
  ['거꾸로 된 범위', '138000', '136000']
])('%s는 적용할 수 없어 null이다', (_name, fromText, toText) => {
  expect(searchRangeOf(fromText, toText)).toBeNull()
})

it('기준이 명성이면 명성 범위로, 점수면 그 점수 범위로 넣고 다른 기준의 범위와 sort는 undefined 키로 둔다', () => {
  expect(criterionFilterOf(undefined, { from: 136000 })).toStrictEqual({
    sort: undefined,
    fameFrom: 136000,
    fameTo: undefined,
    scoreFrom: undefined,
    scoreTo: undefined
  })
  expect(criterionFilterOf('equipmentScore', { from: 1300000, to: 1400000 })).toStrictEqual({
    sort: 'equipmentScore',
    fameFrom: undefined,
    fameTo: undefined,
    scoreFrom: 1300000,
    scoreTo: 1400000
  })
})

it('필터에서 지금 기준의 범위만 읽는다', () => {
  expect(rangeOfFilter({ fameFrom: 136000, scoreTo: 1 })).toStrictEqual({
    from: 136000,
    to: undefined
  })
  expect(rangeOfFilter({ sort: 'buffScore', fameFrom: 136000, scoreTo: 240000 })).toStrictEqual({
    from: undefined,
    to: 240000
  })
})
