import { expect, it } from 'vitest'
import { isMaxLevel } from './character-level'

it.each([
  [115, true],
  [114, false],
  [1, false],
  [null, false]
])('레벨 %s는 만렙 %s', (level, expected) => {
  expect(isMaxLevel(level)).toBe(expected)
})
