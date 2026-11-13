import gsap from 'gsap'
import { type RefObject, useLayoutEffect } from 'react'
import { COLUMN_BAR_GROW } from './useChartBarGrow'
import { cubicBezier, useMotionAllowed } from './gsap-motion'

const GROW_EASE = cubicBezier('chart-svg-grow', '0.2,0,0,1')

// SVG 막대는 CSS 높이가 없으므로 바닥을 기준으로 세로 배율을 키운다. 세로 막대와 같은 시간과 간격을 쓴다.
export function useChartSvgBarGrow(chartRef: RefObject<HTMLElement | null>): void {
  const allowed = useMotionAllowed()

  useLayoutEffect(() => {
    const chart = chartRef.current
    if (chart == null || !allowed.current) {
      return
    }

    const timeline = gsap.timeline()
    for (const [index, bar] of chart.querySelectorAll('[data-chart-bar]').entries()) {
      timeline.fromTo(
        bar,
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: '50% 100%',
          duration: COLUMN_BAR_GROW.seconds,
          ease: GROW_EASE,
          clearProps: 'transform'
        },
        index * COLUMN_BAR_GROW.stagger
      )
    }

    return () => {
      timeline.progress(1).kill()
    }
  }, [chartRef, allowed])
}
