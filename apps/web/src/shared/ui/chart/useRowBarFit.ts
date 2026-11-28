import { type RefObject, useLayoutEffect } from 'react'

const NAME_WIDTH_VAR = '--bar-name-width'
const VALUE_WIDTH_VAR = '--bar-value-width'

// 이름은 말줄임 칸 안에 있어 지금 폭으로는 원래 길이를 알 수 없으므로, 잠깐 내용 폭으로 풀어 잰다.
function contentWidthOf(element: HTMLElement): number {
  const { width, maxWidth } = element.style

  element.style.width = 'max-content'
  element.style.maxWidth = 'none'
  const measured = element.getBoundingClientRect().width
  element.style.width = width
  element.style.maxWidth = maxWidth

  return Math.ceil(measured)
}

function widestOf(
  elements: readonly HTMLElement[],
  extra: (element: HTMLElement) => number
): number {
  return Math.max(0, ...elements.map((element) => contentWidthOf(element) + extra(element)))
}

// useChartBarGrow가 막대 길이를 재기 전에 칸을 맞춰야 하므로 그 hook보다 먼저 부른다.
export function useRowBarFit(
  listRef: RefObject<HTMLElement | null>,
  detailShrink: number,
  bars: readonly unknown[]
): void {
  useLayoutEffect(() => {
    const list = listRef.current
    if (list == null) {
      return
    }

    // 다시 잴 때 값 칸이 세어 올라가는 중간 숫자로 좁아지지 않도록 처음 잰 폭보다 줄이지 않는다.
    let valueWidth = 0

    function fit(): void {
      if (list == null) {
        return
      }

      const names = [...list.querySelectorAll<HTMLElement>('[data-chart-name]')]
      const values = [...list.querySelectorAll<HTMLElement>('[data-chart-value]')]
      const nameWidth = widestOf(names, (name) =>
        name.dataset.chartName === 'detail' ? detailShrink : 0
      )

      list.style.setProperty(NAME_WIDTH_VAR, `${nameWidth}px`)
      valueWidth = Math.max(
        valueWidth,
        widestOf(values, () => 0)
      )
      list.style.setProperty(VALUE_WIDTH_VAR, `${valueWidth}px`)
    }

    fit()

    // 웹 글꼴이 늦게 오면 글자 폭이 바뀌므로 글꼴을 받은 뒤 다시 잰다. jsdom에는 document.fonts가 없다.
    if (!('fonts' in document)) {
      return
    }

    let current = true
    document.fonts.ready.then(() => {
      if (current) {
        fit()
      }
    })

    return () => {
      current = false
    }
  }, [listRef, detailShrink, bars])
}
