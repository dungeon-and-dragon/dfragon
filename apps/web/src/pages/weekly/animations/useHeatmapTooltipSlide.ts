import gsap from 'gsap'
import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react'
import { TOOLTIP_SLIDE, useMotionAllowed } from '../../../animations/gsap-motion'

type Placement = Readonly<{ date: string; side: string | undefined; x: number; y: number }>

// 내용 줄 수가 달라도 칸 쪽 가장자리는 칸에 붙어 있으므로 그 가장자리 가운데를 비교한다.
function placementOf(positioner: HTMLElement, date: string): Placement {
  const box = positioner.getBoundingClientRect()
  const { side } = positioner.dataset
  const centerX = box.left + box.width / 2
  const centerY = box.top + box.height / 2
  switch (side) {
    case 'bottom':
      return { date, side, x: centerX, y: box.top }
    case 'left':
      return { date, side, x: box.right, y: centerY }
    case 'right':
      return { date, side, x: box.left, y: centerY }
    default:
      return { date, side, x: centerX, y: box.bottom }
  }
}

// Positioner의 inline 위치는 Base UI(floating-ui)가 비동기로 다시 쓰므로 건드리지 않는다.
// 새 칸으로 옮겨진 뒤 안쪽 Popup에 이전 위치와의 차이를 transform으로 주고 0으로 되돌린다.
function followPositioner(
  popup: HTMLElement,
  positioner: HTMLElement,
  dateRef: RefObject<string>,
  allowed: RefObject<boolean>
): () => void {
  let placement = placementOf(positioner, dateRef.current)
  let slide: gsap.core.Tween | undefined
  const observer = new MutationObserver(() => {
    const next = placementOf(positioner, dateRef.current)
    if (next.x === placement.x && next.y === placement.y) {
      return
    }

    // 새 칸으로 옮길 때 Base UI는 새 내용을 이전 위치에 둔 채 한 번 더 위치를 고쳐 쓴다.
    // 미끄러지는 동안 생긴 이동은 같은 이동으로 이어받아야 중간값으로 튀지 않는다.
    // 방금 만든 tween은 다음 tick 전까지 gsap.isTweening에 잡히지 않으므로 진행률로 판단한다.
    const previous = placement
    placement = next
    if (previous.side !== next.side) {
      gsap.killTweensOf(popup)
      gsap.set(popup, { x: 0, y: 0 })

      return
    }

    const sliding = slide !== undefined && slide.progress() < 1
    const moved = previous.date !== next.date || sliding
    if (!allowed.current || !moved) {
      return
    }

    slide = gsap.fromTo(
      popup,
      {
        x: Number(gsap.getProperty(popup, 'x')) + previous.x - next.x,
        y: Number(gsap.getProperty(popup, 'y')) + previous.y - next.y
      },
      {
        x: 0,
        y: 0,
        duration: TOOLTIP_SLIDE.seconds,
        ease: TOOLTIP_SLIDE.ease,
        overwrite: 'auto'
      }
    )
  })
  observer.observe(positioner, { attributes: true, attributeFilter: ['style', 'data-side'] })

  return () => {
    observer.disconnect()
    gsap.killTweensOf(popup)
  }
}

export function useHeatmapTooltipSlide(date: string): (popup: HTMLElement | null) => () => void {
  const dateRef = useRef(date)
  const allowed = useMotionAllowed()

  useLayoutEffect(() => {
    dateRef.current = date
  }, [date])

  return useCallback(
    (popup) => {
      const positioner = popup?.parentElement
      if (popup == null || positioner == null) {
        return () => {}
      }

      return followPositioner(popup, positioner, dateRef, allowed)
    },
    [allowed]
  )
}
