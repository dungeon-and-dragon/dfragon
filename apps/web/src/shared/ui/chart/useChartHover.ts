import { type MouseEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
import { type Hover, NO_HOVER } from './plot-layout'

type Press = { event: Event | null; touch: boolean; shown: boolean }

// 행 안의 링크, 펼치기 버튼을 탭하면 그 동작만 하고 값 표시는 그대로 둔다.
const CONTROL_SELECTOR = 'a[href], button'

export type ChartHoverAreaProps = Readonly<{
  onMouseLeave: () => void
  onPointerDown: (event: PointerEvent) => void
  onClick: (event: MouseEvent) => void
}>

// 차트 항목은 mouseenter로 값을 연다. 터치 탭도 브라우저가 보내는 호환 mouseenter로 열리지만,
// 이미 손가락 아래 있던 항목을 다시 누르면 mouseenter가 오지 않으므로 그 탭은 열고 닫기를 뒤집는다.
export function useChartHover(): Readonly<{
  hover: Hover
  show: (key: string) => void
  areaProps: ChartHoverAreaProps
}> {
  const [hover, setHover] = useState<Hover>(NO_HOVER)
  const pressRef = useRef<Press>({ event: null, touch: false, shown: false })

  useEffect(() => {
    if (!hover.open) {
      return
    }

    // 차트 영역의 onPointerDown이 먼저 같은 event를 기록하므로, 기록이 다르면 차트 바깥을 누른 것이다.
    function handleDocumentPointerDown(event: Event): void {
      if (pressRef.current.event !== event) {
        setHover(({ key }) => ({ key, open: false }))
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
    }
  }, [hover.open])

  function show(key: string): void {
    pressRef.current.shown = true
    setHover({ key, open: true })
  }

  function hide(): void {
    setHover(({ key }) => ({ key, open: false }))
  }

  function toggle(): void {
    setHover(({ key, open }) => {
      const toggled = key !== null && !open

      return { key, open: toggled }
    })
  }

  function handlePointerDown(event: PointerEvent): void {
    pressRef.current = {
      event: event.nativeEvent,
      touch: event.pointerType === 'touch',
      shown: false
    }
  }

  function handleClick(event: MouseEvent): void {
    const { touch, shown } = pressRef.current
    const onControl =
      event.target instanceof Element && event.target.closest(CONTROL_SELECTOR) !== null

    if (touch && !shown && !onControl) {
      toggle()
    }
  }

  return {
    hover,
    show,
    areaProps: { onMouseLeave: hide, onPointerDown: handlePointerDown, onClick: handleClick }
  }
}
