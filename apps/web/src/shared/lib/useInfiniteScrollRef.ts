import { useCallback } from 'react'

// onVisible이 바뀌면 새 ref callback이 되어 observer를 다시 만든다. 그래서 줄을 더한 뒤에도 감시 요소가 아직 화면 안이면 이어서 부른다.
export function useInfiniteScrollRef<T extends Element>(
  onVisible: () => void
): (element: T) => () => void {
  return useCallback(
    (element: T) => {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible()
        }
      })
      observer.observe(element)

      return () => observer.disconnect()
    },
    [onVisible]
  )
}
