import gsap from 'gsap'
import { type RefObject, useEffectEvent, useLayoutEffect, useRef } from 'react'
import { cubicBezier, type Motion, useMotionAllowed } from './gsap-motion'

type Placement = Readonly<{ element: HTMLElement; left: number; width: number }>

// GSAP은 CSS 변수를 읽지 못해 theme.css의 --ease-standard와 같은 곡선을 숫자로 적는다.
// 길이는 다중 검색 탭 표시 막대의 CSS transition(duration-380)과 맞춘다.
const SLIDE: Motion = {
  seconds: 0.38,
  ease: cubicBezier('indicator-slide', '0.2, 0, 0, 1')
}

function measure(
  container: HTMLElement,
  target: HTMLElement,
  box: 'border' | 'content'
): { left: number; width: number } {
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  let left = targetRect.left - containerRect.left - container.clientLeft + container.scrollLeft
  let width = targetRect.width
  if (box === 'content') {
    const style = getComputedStyle(target)
    const paddingLeft = Number.parseFloat(style.paddingLeft)
    left += paddingLeft
    width -= paddingLeft + Number.parseFloat(style.paddingRight)
  }

  return { left, width }
}

// 처음 그릴 때, 표시 막대가 숨었다가 다시 보일 때, 크기가 바뀔 때는 미끄러지지 않고 바로 둔다.
// 다시 그려도 목표가 같으면 진행 중인 tween을 다시 시작하지 않는다.
export function useIndicatorSlide({
  containerRef,
  indicatorRef,
  targetSelector,
  box = 'border'
}: {
  containerRef: RefObject<HTMLElement | null>
  indicatorRef: RefObject<HTMLElement | null>
  targetSelector: string
  box?: 'border' | 'content'
}): void {
  const placedRef = useRef<Placement | null>(null)
  const allowed = useMotionAllowed()

  const place = useEffectEvent((sliding: boolean): HTMLElement | null => {
    const placed = placedRef.current
    const indicator = indicatorRef.current
    const container = containerRef.current
    if (placed != null && placed.element !== indicator) {
      gsap.killTweensOf(placed.element)
      placedRef.current = null
    }

    if (indicator == null || container == null) {
      return null
    }

    const target = container.querySelector<HTMLElement>(targetSelector)
    if (target == null) {
      gsap.killTweensOf(indicator)
      gsap.set(indicator, { visibility: 'hidden' })
      placedRef.current = null

      return null
    }

    const { left, width } = measure(container, target, box)
    const current = placedRef.current
    if (current != null && current.left === left && current.width === width) {
      return target
    }

    placedRef.current = { element: indicator, left, width }
    if (sliding && current != null && allowed.current) {
      gsap.to(indicator, {
        left,
        width,
        duration: SLIDE.seconds,
        ease: SLIDE.ease,
        overwrite: true,
        autoRound: false
      })
    } else {
      gsap.set(indicator, { left, width, visibility: 'visible', overwrite: true, autoRound: false })
    }

    return target
  })

  const observerRef = useRef<ResizeObserver | null>(null)
  const observedRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    function placeWithoutSliding(): void {
      place(false)
    }

    // 처음 잰 뒤 글꼴을 다 받아 목표 폭이 달라지면 다시 잰다.
    const observer = new ResizeObserver(placeWithoutSliding)
    observerRef.current = observer
    window.addEventListener('resize', placeWithoutSliding)

    return () => {
      observer.disconnect()
      observerRef.current = null
      observedRef.current = null
      window.removeEventListener('resize', placeWithoutSliding)
      const placed = placedRef.current
      if (placed != null) {
        gsap.killTweensOf(placed.element)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const target = place(true)
    const observed = observedRef.current
    if (target === observed) {
      return
    }

    if (observed != null) {
      observerRef.current?.unobserve(observed)
    }

    if (target != null) {
      observerRef.current?.observe(target)
    }
    observedRef.current = target
  })
}
