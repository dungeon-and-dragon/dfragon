import gsap from 'gsap'
import { type RefObject, useLayoutEffect } from 'react'
import { cubicBezier, useMotionAllowed } from './gsap-motion'

export type BarGrow = Readonly<{ property: 'width' | 'height'; seconds: number; stagger: number }>

export const ROW_BAR_GROW: BarGrow = { property: 'width', seconds: 0.7, stagger: 0.04 }
export const COLUMN_BAR_GROW: BarGrow = { property: 'height', seconds: 0.6, stagger: 0.022 }

const GROW_EASE = cubicBezier('chart-grow', '0.2,0,0,1')
const NAME_ENTER_SECONDS = 0.3
const NAME_ENTER_OFFSET = -6
const MARK_FADE_SECONDS = 0.12
const COUNT_FADE_SECONDS = 0.15

const integer = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

function countUp(timeline: gsap.core.Timeline, count: HTMLElement, at: number, seconds: number) {
  const finalText = count.textContent
  const target = Number(count.dataset.chartCount)
  const shown = { value: 0 }
  timeline.to(
    shown,
    {
      value: target,
      duration: seconds,
      ease: GROW_EASE,
      onUpdate() {
        count.textContent = this.progress() === 1 ? finalText : integer.format(shown.value)
      }
    },
    at
  )
  timeline.from(
    count,
    { autoAlpha: 0, duration: COUNT_FADE_SECONDS, ease: 'none', clearProps: 'opacity,visibility' },
    at
  )
}

// 차트를 처음 그릴 때 한 번만 재생한다. 끝난 뒤 값이 바뀌면 React가 쓴 새 길이와 숫자가 바로 보인다.
// StyleX는 길이를 CSS 변수로 넘겨 inline 길이가 비어 있으므로, 잰 길이까지 자란 뒤 inline 값을 지워 % 길이로 돌려놓는다.
export function useChartBarGrow(chartRef: RefObject<HTMLElement | null>, grow: BarGrow): void {
  const allowed = useMotionAllowed()

  useLayoutEffect(() => {
    const chart = chartRef.current
    if (chart == null || !allowed.current) {
      return
    }

    const timeline = gsap.timeline()
    for (const [index, item] of chart.querySelectorAll('[data-chart-item]').entries()) {
      const at = index * grow.stagger
      const mark = item.querySelector<HTMLElement>('[data-chart-mark]')
      if (mark != null) {
        timeline.fromTo(
          mark,
          { [grow.property]: 0 },
          {
            [grow.property]: getComputedStyle(mark)[grow.property],
            duration: grow.seconds,
            ease: GROW_EASE,
            clearProps: grow.property
          },
          at
        )
        timeline.from(
          mark,
          {
            autoAlpha: 0,
            duration: MARK_FADE_SECONDS,
            ease: 'none',
            clearProps: 'opacity,visibility'
          },
          at
        )
      }

      const name = item.querySelector('[data-chart-name]')
      if (name != null) {
        timeline.from(
          name,
          {
            autoAlpha: 0,
            x: NAME_ENTER_OFFSET,
            duration: NAME_ENTER_SECONDS,
            ease: GROW_EASE,
            clearProps: 'opacity,visibility,transform'
          },
          at
        )
      }

      const count = item.querySelector<HTMLElement>('[data-chart-count]')
      if (count != null) {
        countUp(timeline, count, at, grow.seconds)
      }
    }

    // StrictMode가 effect를 한 번 더 돌릴 때 중간값이 남으면 다음 진입이 0에서 0으로 자라므로 끝 상태로 보낸다.

    return () => {
      timeline.progress(1).kill()
    }
  }, [chartRef, grow, allowed])
}
