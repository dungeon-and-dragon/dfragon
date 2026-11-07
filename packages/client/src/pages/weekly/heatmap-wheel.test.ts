import { expect, it } from 'vitest'
import { wheelScrollTarget } from './heatmap-wheel'

it('아래로 굴리면 오른쪽, 위로 굴리면 왼쪽으로 delta만큼 옮긴 위치를 목표로 한다', () => {
  expect(wheelScrollTarget({ deltaX: 0, deltaY: 100, from: 50, max: 400 })).toBe(150)
  expect(wheelScrollTarget({ deltaX: 0, deltaY: -40, from: 50, max: 400 })).toBe(10)
})

it('목표 위치는 왼쪽 끝 0과 오른쪽 끝 max를 넘지 않는다', () => {
  expect(wheelScrollTarget({ deltaX: 0, deltaY: 100, from: 350, max: 400 })).toBe(400)
  expect(wheelScrollTarget({ deltaX: 0, deltaY: -100, from: 30, max: 400 })).toBe(0)
})

it('이미 오른쪽 끝에서 아래로, 왼쪽 끝에서 위로 굴리면 가로채지 않는다', () => {
  expect(wheelScrollTarget({ deltaX: 0, deltaY: 100, from: 400, max: 400 })).toBeUndefined()
  expect(wheelScrollTarget({ deltaX: 0, deltaY: -100, from: 0, max: 400 })).toBeUndefined()
})

it('가로 스크롤이 없으면 가로채지 않는다', () => {
  expect(wheelScrollTarget({ deltaX: 0, deltaY: 100, from: 0, max: 0 })).toBeUndefined()
})

it('가로 delta가 세로 delta보다 크거나 같은 입력은 가로채지 않는다', () => {
  expect(wheelScrollTarget({ deltaX: 30, deltaY: 30, from: 100, max: 400 })).toBeUndefined()
  expect(wheelScrollTarget({ deltaX: -50, deltaY: 10, from: 100, max: 400 })).toBeUndefined()
})
