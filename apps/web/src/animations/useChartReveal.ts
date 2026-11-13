import gsap from 'gsap'
import { type RefObject, useLayoutEffect } from 'react'
import { cubicBezier, useMotionAllowed } from './gsap-motion'

export type Reveal = Readonly<{ seconds: number; stagger: number; endSeconds: number }>

export const LINE_REVEAL: Reveal = { seconds: 1, stagger: 0, endSeconds: 0.25 }
export const BOX_PLOT_REVEAL: Reveal = { seconds: 0.7, stagger: 0.04, endSeconds: 0.25 }
export const SPLIT_BAR_REVEAL: Reveal = { seconds: 0.9, stagger: 0, endSeconds: 0 }

const REVEAL_EASE = cubicBezier('chart-reveal', '0.2,0,0,1')
const HIDDEN = 'inset(0% 100% 0% 0%)'
const SHOWN = 'inset(0% 0% 0% 0%)'

export function useChartReveal(chartRef: RefObject<HTMLElement | null>, reveal: Reveal): void {
  const allowed = useMotionAllowed()

  useLayoutEffect(() => {
    const chart = chartRef.current
    if (chart == null || !allowed.current) {
      return
    }

    const timeline = gsap.timeline()
    const parts = [...chart.querySelectorAll('[data-chart-reveal]')]
    for (const [index, part] of parts.entries()) {
      timeline.fromTo(
        part,
        { clipPath: HIDDEN },
        { clipPath: SHOWN, duration: reveal.seconds, ease: REVEAL_EASE, clearProps: 'clipPath' },
        index * reveal.stagger
      )
    }

    const ends = chart.querySelectorAll('[data-chart-end]')
    if (ends.length > 0) {
      timeline.from(
        ends,
        {
          autoAlpha: 0,
          duration: reveal.endSeconds,
          ease: 'none',
          clearProps: 'opacity,visibility'
        },
        reveal.seconds + Math.max(parts.length - 1, 0) * reveal.stagger
      )
    }

    // StrictMode가 effect를 한 번 더 돌릴 때 중간값이 남지 않도록 끝 상태로 보낸다.

    return () => {
      timeline.progress(1).kill()
    }
  }, [chartRef, reveal, allowed])
}
