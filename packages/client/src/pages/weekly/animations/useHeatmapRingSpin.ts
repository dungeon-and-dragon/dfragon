import gsap from 'gsap'
import { type RefObject, useEffect } from 'react'
import { MOTION_QUERY } from '../../../animations/gsap-motion'

const RING_TURN_SECONDS = 4

export function useHeatmapRingSpin(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const element = ref.current
    if (!enabled || element == null) {
      return
    }

    const media = gsap.matchMedia()
    media.add(MOTION_QUERY, () => {
      gsap.fromTo(
        element,
        { '--heatmap-ring-angle': 0 },
        { '--heatmap-ring-angle': 360, duration: RING_TURN_SECONDS, ease: 'none', repeat: -1 }
      )
    })

    return () => media.revert()
  }, [ref, enabled])
}
