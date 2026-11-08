import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { type RefObject, useLayoutEffect, useRef } from 'react'

gsap.registerPlugin(CustomEase)

export const MOTION_QUERY = '(prefers-reduced-motion: no-preference)'

export type Motion = Readonly<{ seconds: number; ease: gsap.EaseFunction }>

export function cubicBezier(id: string, curve: string): gsap.EaseFunction {
  return CustomEase.create(id, curve)
}

export const FILL_GROW: Motion = {
  seconds: 0.8,
  ease: cubicBezier('season-fill', '0.4,0,0.2,1')
}

export function fillWidth(progress: number): string {
  return `${progress * 100}%`
}

export function useMotionAllowed(): RefObject<boolean> {
  const allowed = useRef(false)

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add(MOTION_QUERY, () => {
      allowed.current = true

      return () => {
        allowed.current = false
      }
    })

    return () => media.revert()
  }, [])

  return allowed
}

// React가 이 속성을 inline style로 다시 쓰면 tween 중간값이 덮이므로 GSAP만 쓴다. 처음 값은 움직이지 않고 바로 둔다.
export function useTweenedStyle(
  ref: RefObject<HTMLElement | null>,
  property: 'width' | 'opacity',
  value: string | number,
  motion: Motion,
  allowed: RefObject<boolean>
): void {
  const placedRef = useRef(false)

  useLayoutEffect(() => {
    const element = ref.current
    if (element == null) {
      return
    }

    if (placedRef.current && allowed.current) {
      gsap.to(element, { [property]: value, duration: motion.seconds, ease: motion.ease })
    } else {
      gsap.set(element, { [property]: value })
    }

    placedRef.current = true

    return () => {
      gsap.killTweensOf(element, property)
    }
  }, [ref, property, value, motion, allowed])
}
