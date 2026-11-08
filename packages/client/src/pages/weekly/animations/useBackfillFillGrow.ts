import type { RefObject } from 'react'
import { useMotionAllowed } from '../../../animations/gsap-motion'
import { FILL_GROW, fillWidth, useTweenedStyle } from './gsap-motion'

export function useBackfillFillGrow(ref: RefObject<HTMLElement | null>, progress: number): void {
  const allowed = useMotionAllowed()
  useTweenedStyle(ref, 'width', fillWidth(progress), FILL_GROW, allowed)
}
