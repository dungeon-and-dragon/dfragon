import gsap from 'gsap'
import { type RefObject, useLayoutEffect } from 'react'
import { TOOLTIP_FADE, TOOLTIP_SLIDE, useMotionAllowed } from '#shared/lib/animations/gsap-motion'

export type TooltipPlace = Readonly<{ x: number; y: number }>

export type PlaceTooltip = (
  anchor: HTMLElement,
  tooltip: HTMLElement,
  chart: HTMLElement
) => TooltipPlace

// 공용 Tooltip의 collisionPadding과 같은 창 가장자리 여백
const VIEWPORT_GUTTER = 16

// 차트가 가로 스크롤 영역 안에 있으면 차트 상자 기준 자리가 창 밖일 수 있어, 창 좌우 여백 안으로 당긴다.
function insideViewport(
  { x, y }: TooltipPlace,
  tooltip: HTMLElement,
  chart: HTMLElement
): TooltipPlace {
  const chartLeft = chart.getBoundingClientRect().left
  const minX = VIEWPORT_GUTTER - chartLeft
  const maxX =
    document.documentElement.clientWidth - VIEWPORT_GUTTER - tooltip.offsetWidth - chartLeft
  const clampedX = Math.min(Math.max(x, minX), Math.max(minX, maxX))

  return { x: clampedX, y }
}

// React가 툴팁의 transform, opacity, visibility를 inline style로 쓰면 tween 중간값이 덮이므로 GSAP만 쓴다.
export function useChartTooltipSlide({
  chartRef,
  tooltipRef,
  anchorsRef,
  shownKey,
  open,
  bars,
  placeOf
}: {
  chartRef: RefObject<HTMLElement | null>
  tooltipRef: RefObject<HTMLElement | null>
  anchorsRef: RefObject<ReadonlyMap<string, HTMLElement>>
  shownKey: string | undefined
  open: boolean
  bars: readonly unknown[]
  placeOf: PlaceTooltip
}): void {
  const allowed = useMotionAllowed()

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const chart = chartRef.current
    if (tooltip == null || chart == null) {
      return
    }

    const anchor = shownKey != null ? anchorsRef.current.get(shownKey) : undefined
    if (!open || anchor == null) {
      if (allowed.current) {
        gsap.to(tooltip, {
          autoAlpha: 0,
          duration: TOOLTIP_FADE.seconds,
          ease: TOOLTIP_FADE.ease,
          overwrite: 'auto'
        })
      } else {
        gsap.set(tooltip, { autoAlpha: 0, overwrite: true })
      }

      return
    }

    const { x, y } = insideViewport(placeOf(anchor, tooltip, chart), tooltip, chart)
    if (!allowed.current) {
      gsap.set(tooltip, { x, y, autoAlpha: 1, overwrite: true })

      return
    }

    const shown = Number(gsap.getProperty(tooltip, 'opacity')) > 0
    if (shown) {
      gsap.to(tooltip, {
        x,
        y,
        duration: TOOLTIP_SLIDE.seconds,
        ease: TOOLTIP_SLIDE.ease,
        overwrite: 'auto'
      })
    } else {
      gsap.set(tooltip, { x, y, overwrite: 'auto' })
    }

    gsap.to(tooltip, {
      autoAlpha: 1,
      duration: TOOLTIP_FADE.seconds,
      ease: TOOLTIP_FADE.ease,
      overwrite: 'auto'
    })
  }, [chartRef, tooltipRef, anchorsRef, shownKey, open, bars, placeOf, allowed])

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current

    return () => {
      if (tooltip != null) {
        gsap.killTweensOf(tooltip)
      }
    }
  }, [tooltipRef, bars])
}
