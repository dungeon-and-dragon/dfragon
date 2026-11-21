import { type RefCallback, useCallback, useState } from 'react'

export function useObservedHeight(): [RefCallback<HTMLElement>, number] {
  const [height, setHeight] = useState(0)
  const observe = useCallback((element: HTMLElement | null) => {
    if (element === null) {
      return
    }

    const target = element

    function measure(): void {
      setHeight(target.offsetHeight)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(target)

    return () => {
      observer.disconnect()
      setHeight(0)
    }
  }, [])

  return [observe, height]
}
