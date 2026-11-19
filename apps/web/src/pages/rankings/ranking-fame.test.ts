import { expect, it } from 'vitest'
import { fameRangeOf } from './ranking-fame'

it('두 칸의 정수를 범위로 읽고, 빈 칸은 그쪽 끝을 두지 않으며 앞뒤 공백은 버린다', () => {
  expect(fameRangeOf('136000', '138000')).toEqual({ fameFrom: 136000, fameTo: 138000 })
  expect(fameRangeOf(' 136000 ', '')).toEqual({ fameFrom: 136000 })
  expect(fameRangeOf('', '0')).toEqual({ fameTo: 0 })
  expect(fameRangeOf('', '999999999')).toEqual({ fameTo: 999999999 })
  expect(fameRangeOf('138000', '138000')).toEqual({ fameFrom: 138000, fameTo: 138000 })
  expect(fameRangeOf('', '  ')).toEqual({})
})

it.each([
  ['쉼표', '136,000', ''],
  ['음수', '-1', ''],
  ['소수', '', '1.5'],
  ['0으로 시작하는 수', '0136000', ''],
  ['10자리 이상', '', '1000000000'],
  ['거꾸로 된 범위', '138000', '136000']
])('%s는 적용할 수 없어 null이다', (_name, fromText, toText) => {
  expect(fameRangeOf(fromText, toText)).toBeNull()
})
