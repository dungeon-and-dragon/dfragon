import gsap from 'gsap'
import { type RefObject, useEffect } from 'react'
import { cubicBezier, MOTION_QUERY } from './gsap-motion'

// GSAP은 CSS 변수를 읽지 못해 theme.css의 --ease-standard 곡선과 --beat(0.9초)를 숫자로 적는다.
const HALF_PASS_SECONDS = 0.9
const STANDARD_EASE = cubicBezier('loading-line', '0.2, 0, 0, 1')
// 진행 조각은 막대 폭의 1/3이고 가운데에 놓여 있어, 자기 폭의 두 배만큼 옮기면 막대 밖으로 나간다.
const OUTSIDE_PERCENT = 200
const SHORT_SCALE = 0.5

export function useLoadingLinePass(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const segment = ref.current

    if (segment == null) {
      return
    }

    const media = gsap.matchMedia()
    media.add(MOTION_QUERY, () => {
      gsap
        .timeline({ repeat: -1 })
        .fromTo(
          segment,
          { xPercent: -OUTSIDE_PERCENT, scaleX: SHORT_SCALE, transformOrigin: 'left center' },
          { xPercent: 0, scaleX: 1, duration: HALF_PASS_SECONDS, ease: STANDARD_EASE }
        )
        .to(segment, {
          xPercent: OUTSIDE_PERCENT,
          scaleX: SHORT_SCALE,
          duration: HALF_PASS_SECONDS,
          ease: STANDARD_EASE
        })
    })

    return () => media.revert()
  }, [ref])
}
