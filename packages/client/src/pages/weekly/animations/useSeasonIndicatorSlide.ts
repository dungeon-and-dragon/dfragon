import gsap from 'gsap'
import { type RefObject, useLayoutEffect, useRef } from 'react'
import type { ActivitySeason } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { cubicBezier, type Motion, useMotionAllowed } from './gsap-motion'

type Placement = Readonly<{ element: HTMLElement; left: number; width: number }>

const SLIDE: Motion = {
  seconds: 0.38,
  ease: cubicBezier('season-indicator', '0.2,0.8,0.2,1')
}

// 처음 그릴 때와 창 크기가 바뀔 때는 표시 막대를 미끄러지지 않고 고른 시즌 위에 바로 둔다.
// 시즌을 고른 뒤 새 응답으로 다시 그려도 목표가 같으면 진행 중인 tween을 다시 시작하지 않는다.
export function useSeasonIndicatorSlide({
  timelineRef,
  indicatorRef,
  selectedId,
  seasons,
  hasSelection
}: {
  timelineRef: RefObject<HTMLElement | null>
  indicatorRef: RefObject<HTMLElement | null>
  selectedId: number
  seasons: readonly ActivitySeason[]
  hasSelection: boolean
}): void {
  const placedRef = useRef<Placement | null>(null)
  const allowed = useMotionAllowed()

  useLayoutEffect(() => {
    const indicator = indicatorRef.current
    const selected = timelineRef.current?.querySelector<HTMLElement>('[aria-current="true"]')
    if (indicator == null || selected == null) {
      return
    }

    function place(sliding: boolean): void {
      if (indicator == null || selected == null) {
        return
      }

      const placement = {
        element: indicator,
        left: selected.offsetLeft,
        width: selected.offsetWidth
      }
      const placed = placedRef.current
      if (
        placed?.element === indicator &&
        placed.left === placement.left &&
        placed.width === placement.width
      ) {
        return
      }

      placedRef.current = placement
      const vars = { left: placement.left, width: placement.width, overwrite: true }
      if (sliding && placed?.element === indicator && allowed.current) {
        gsap.to(indicator, { ...vars, duration: SLIDE.seconds, ease: SLIDE.ease })
      } else {
        gsap.set(indicator, vars)
      }
    }
    function placeWithoutSliding(): void {
      place(false)
    }

    place(true)
    window.addEventListener('resize', placeWithoutSliding)

    return () => window.removeEventListener('resize', placeWithoutSliding)
  }, [timelineRef, indicatorRef, selectedId, seasons, allowed])

  useLayoutEffect(() => {
    const indicator = indicatorRef.current
    if (indicator == null) {
      return
    }

    return () => {
      gsap.killTweensOf(indicator)
    }
  }, [indicatorRef, hasSelection])
}
