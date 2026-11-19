import type { RefObject } from 'react'
import { useIndicatorSlide } from '#shared/lib/animations/useIndicatorSlide'

export function useSeasonIndicatorSlide({
  timelineRef,
  indicatorRef
}: {
  timelineRef: RefObject<HTMLElement | null>
  indicatorRef: RefObject<HTMLElement | null>
}): void {
  useIndicatorSlide({
    containerRef: timelineRef,
    indicatorRef,
    targetSelector: '[aria-current="true"]'
  })
}
