import type { RefObject } from 'react'
import { type Motion, useMotionAllowed } from '../../../animations/gsap-motion'
import { FILL_GROW, fillWidth, useTweenedStyle } from './gsap-motion'

const FADE: Motion = { seconds: 0.5, ease: FILL_GROW.ease }

export function usePrimevalFillFade(
  ref: RefObject<HTMLElement | null>,
  progress: number,
  visible: boolean
): void {
  const allowed = useMotionAllowed()
  useTweenedStyle(ref, 'width', fillWidth(progress), FILL_GROW, allowed)
  useTweenedStyle(ref, 'opacity', visible ? 1 : 0, FADE, allowed)
}
