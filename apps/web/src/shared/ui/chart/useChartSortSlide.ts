import gsap from 'gsap'
import { type RefObject, useLayoutEffect, useRef } from 'react'
import { cubicBezier, useMotionAllowed } from '#shared/lib/animations/gsap-motion'

const SORT_EASE = cubicBezier('chart-sort', '0.2,0,0,1')
const SORT_SECONDS = 0.5

// 순서가 바뀐 칸은 React가 새 자리에 그린 뒤, 옛 자리만큼 되돌린 곳에서 새 자리로 미끄러진다.
// hover나 폭 변화로 다시 그릴 때는 움직이지 않도록 순서가 바뀔 때만 재생하고, 옛 자리는 그릴 때마다 새로 적어 둔다.
export function useChartSortSlide(
  chartRef: RefObject<HTMLElement | null>,
  centers: ReadonlyMap<string, number>
): void {
  const allowed = useMotionAllowed()
  const previous = useRef<ReadonlyMap<string, number>>(centers)
  const order = [...centers.entries()]
    .toSorted(([, a], [, b]) => a - b)
    .map(([key]) => key)
    .join('\n')

  // biome-ignore lint/correctness/useExhaustiveDependencies: 자리는 hover와 폭 변화에도 바뀌므로 순서가 바뀐 때만 재생한다.
  useLayoutEffect(() => {
    const chart = chartRef.current
    const before = previous.current

    if (chart == null || !allowed.current) {
      return
    }

    const tweens = [...chart.querySelectorAll<SVGElement>('[data-chart-slot]')].flatMap(
      (element) => {
        const key = element.dataset.chartSlot ?? ''
        const from = before.get(key)
        const to = centers.get(key)

        if (from == null || to == null || from === to) {
          return []
        }

        const shift = { x: from - to }
        const settle = { x: 0, duration: SORT_SECONDS, ease: SORT_EASE, clearProps: 'x' }

        return [gsap.fromTo(element, shift, settle)]
      }
    )

    return () => {
      for (const tween of tweens) {
        tween.progress(1).kill()
      }
    }
  }, [chartRef, order, allowed])

  useLayoutEffect(() => {
    previous.current = centers
  })
}
