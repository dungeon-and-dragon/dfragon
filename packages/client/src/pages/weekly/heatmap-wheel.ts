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

  const target = Math.min(Math.max(from + deltaY, 0), max)
  if (target === from) {
    return undefined
  }

  return target
}
