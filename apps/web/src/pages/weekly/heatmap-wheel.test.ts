import { expect, it } from 'vitest'
import { wheelAction, wheelScrollTarget } from './heatmap-wheel'

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

it('끝까지 1px이 남지 않은 소수 위치에서 그 방향으로 굴리면 가로채지 않는다', () => {
  expect(wheelScrollTarget({ deltaX: 0, deltaY: 100, from: 399.5, max: 400 })).toBeUndefined()
  expect(wheelScrollTarget({ deltaX: 0, deltaY: -100, from: 0.4, max: 400 })).toBeUndefined()
})

it('가운데에서는 1px보다 작은 휠도 가로로 옮긴다', () => {
  expect(wheelScrollTarget({ deltaX: 0, deltaY: 0.5, from: 200, max: 400 })).toBe(200.5)
})

it('가로 스크롤이 없으면 가로채지 않는다', () => {
  expect(wheelScrollTarget({ deltaX: 0, deltaY: 100, from: 0, max: 0 })).toBeUndefined()
})

it('가로 delta가 세로 delta보다 크거나 같은 입력은 가로채지 않는다', () => {
  expect(wheelScrollTarget({ deltaX: 30, deltaY: 30, from: 100, max: 400 })).toBeUndefined()
  expect(wheelScrollTarget({ deltaX: -50, deltaY: 10, from: 100, max: 400 })).toBeUndefined()
})

const atRightEnd = { deltaX: 0, deltaY: 100, from: 400, max: 400 }

it('가운데에서 굴리면 가로로 옮긴다', () => {
  expect(
    wheelAction({ deltaX: 0, deltaY: 100, from: 50, max: 400, now: 1000, lastHeldAt: undefined })
  ).toEqual({ kind: 'scroll', target: 150 })
})

it('가로로 움직인 휠이 400ms 안에 이어지면 끝에 닿은 뒤에도 페이지로 넘기지 않는다', () => {
  expect(wheelAction({ ...atRightEnd, now: 1399, lastHeldAt: 1000 })).toEqual({ kind: 'hold' })
})

it('끝에서 400ms 쉰 뒤 다시 굴리면 페이지로 넘긴다', () => {
  expect(wheelAction({ ...atRightEnd, now: 1400, lastHeldAt: 1000 })).toEqual({ kind: 'pass' })
})

it('처음부터 끝에서 굴리기 시작한 휠은 바로 페이지로 넘긴다', () => {
  expect(wheelAction({ ...atRightEnd, now: 1000, lastHeldAt: undefined })).toEqual({
    kind: 'pass'
  })
})

it('가로 스크롤이 없거나 가로 제스처면 이어진 휠이어도 넘긴다', () => {
  expect(
    wheelAction({ deltaX: 0, deltaY: 100, from: 0, max: 0, now: 1100, lastHeldAt: 1000 })
  ).toEqual({ kind: 'pass' })
  expect(
    wheelAction({ deltaX: 60, deltaY: 10, from: 400, max: 400, now: 1100, lastHeldAt: 1000 })
  ).toEqual({ kind: 'pass' })
})
