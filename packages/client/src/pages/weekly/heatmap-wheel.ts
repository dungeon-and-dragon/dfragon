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
