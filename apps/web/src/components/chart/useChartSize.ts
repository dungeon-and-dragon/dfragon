import { type RefObject, useLayoutEffect, useState } from 'react'

export type ChartSize = Readonly<{ width: number; height: number }>

// SVG 글자와 선 굵기가 늘어나지 않도록 viewBox를 실제 크기로 맞춘다. 재기 전에는 기본 크기로 그린다.
export function useChartSize(
  elementRef: RefObject<HTMLElement | null>,
  fallback: ChartSize
): ChartSize {
  const [size, setSize] = useState(fallback)

  useLayoutEffect(() => {
    const element = elementRef.current
    if (element == null) {
      return
    }

    function measure(): void {
      if (element == null) {
        return
      }

      const width = Math.round(element.clientWidth)
      const height = Math.round(element.clientHeight)
      if (width > 0 && height > 0) {
        setSize((current) => {
          if (current.width === width && current.height === height) {
            return current
          }

          return { width, height }
        })
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => observer.disconnect()
  }, [elementRef])

  return size
}
