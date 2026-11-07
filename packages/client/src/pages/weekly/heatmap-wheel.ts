export type WheelScroll = Readonly<{
  deltaX: number
  deltaY: number
  from: number
  max: number
}>

export function wheelScrollTarget({ deltaX, deltaY, from, max }: WheelScroll): number | undefined {
  if (max <= 0 || Math.abs(deltaX) >= Math.abs(deltaY)) {
    return undefined
  }

  // 브라우저 확대에서는 끝의 scrollLeft가 소수라 끝까지 1px이 남지 않으면 끝으로 본다.
  const room = deltaY > 0 ? max - from : from
  if (room < 1) {
    return undefined
  }

  return Math.min(Math.max(from + deltaY, 0), max)
}

// 마우스 휠을 한 번 튕길 때 칸 사이 간격(수십~200ms)과 트랙패드 관성 이벤트 간격(한 frame 남짓)은 한 동작으로 이어 보고,
// 손을 뗐다 다시 굴리는 쉼은 그보다 길어 400ms로 나눈다.
const WHEEL_HOLD_MS = 400

export type WheelAction =
  | Readonly<{ kind: 'scroll'; target: number }>
  | Readonly<{ kind: 'hold' }>
  | Readonly<{ kind: 'pass' }>

export function wheelAction(
  wheel: WheelScroll & Readonly<{ now: number; lastHeldAt: number | undefined }>
): WheelAction {
  const target = wheelScrollTarget(wheel)
  if (target !== undefined) {
    return { kind: 'scroll', target }
  }

  const { deltaX, deltaY, max, now, lastHeldAt } = wheel
  const vertical = max > 0 && Math.abs(deltaX) < Math.abs(deltaY)
  if (vertical && lastHeldAt !== undefined && now - lastHeldAt < WHEEL_HOLD_MS) {
    return { kind: 'hold' }
  }

  return { kind: 'pass' }
}
