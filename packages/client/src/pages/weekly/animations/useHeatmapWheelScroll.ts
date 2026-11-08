import gsap from 'gsap'
import { type RefObject, useEffect } from 'react'
import { wheelAction } from '../heatmap-wheel'
import { MOTION_QUERY } from './gsap-motion'

const WHEEL_SCROLL_SECONDS = 0.35

export function useHeatmapWheelScroll(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current
    if (element == null) {
      return
    }

    let duration = 0
    let target: number | undefined
    let lastHeldAt: number | undefined
    const media = gsap.matchMedia()
    media.add(MOTION_QUERY, () => {
      duration = WHEEL_SCROLL_SECONDS

      return () => {
        duration = 0
      }
    })

    function handleComplete(): void {
      target = undefined
    }

    function handleWheel(event: WheelEvent): void {
      if (element == null) {
        return
      }

      const action = wheelAction({
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        from: target ?? element.scrollLeft,
        max: element.scrollWidth - element.clientWidth,
        now: event.timeStamp,
        lastHeldAt
      })
      if (action.kind === 'pass') {
        return
      }

      event.preventDefault()
      lastHeldAt = event.timeStamp
      if (action.kind === 'hold') {
        return
      }

      target = action.target
      gsap.to(element, {
        scrollLeft: action.target,
        duration,
        ease: 'power2.out',
        overwrite: true,
        onComplete: handleComplete
      })
    }

    element.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      element.removeEventListener('wheel', handleWheel)
      gsap.killTweensOf(element)
      media.revert()
    }
  }, [ref])
}
