import gsap from 'gsap'
import { type RefObject, useEffect } from 'react'

const RING_TURN_SECONDS = 4

export function useRingRotation(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  angleProperty: `--${string}`
): void {
  useEffect(() => {
    const element = ref.current
    if (!enabled || element == null) {
      return
    }

    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        element,
        { [angleProperty]: 0 },
        { [angleProperty]: 360, duration: RING_TURN_SECONDS, ease: 'none', repeat: -1 }
      )
    })

    return () => media.revert()
  }, [ref, enabled, angleProperty])
}
