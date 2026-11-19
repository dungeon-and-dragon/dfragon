import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { type RefObject, useLayoutEffect, useRef } from 'react'

gsap.registerPlugin(CustomEase)

export const MOTION_QUERY = '(prefers-reduced-motion: no-preference)'

export type Motion = Readonly<{ seconds: number; ease: gsap.EaseFunction }>

export function cubicBezier(id: string, curve: string): gsap.EaseFunction {
  return CustomEase.create(id, curve)
}

const TOOLTIP_EASE = cubicBezier('tooltip', '0.2,0,0,1')
export const TOOLTIP_SLIDE: Motion = { seconds: 0.2, ease: TOOLTIP_EASE }
export const TOOLTIP_FADE: Motion = { seconds: 0.12, ease: TOOLTIP_EASE }

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
