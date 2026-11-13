// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LineChart, type LineSeries } from './LineChart'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(element: React.JSX.Element): Promise<void> {
  await act(async () => root.render(element))
}

function formatPercent(value: number): string {
  return `${value}%`
}

const weeks = ['1주차', '2주차', '3주차', '4주차'].map((title, index) => ({
  key: `week-${index}`,
  title,
  tick: index % 2 === 0 ? title : null
}))

function series(index: number, values: readonly (number | null)[]): LineSeries {
  return { key: `series-${index}`, name: `컨텐츠${index}`, color: `#00000${index}`, values }
}

function legendNames(): string[] {
  return [...container.querySelectorAll('ul li')]
    .filter((item) => item.querySelector('i') != null)
    .map((item) => item.textContent ?? '')
}

describe('LineChart', () => {
  it('값이 없는 칸에서 선을 끊고 계열마다 마지막 값에 끝점을 둔다', async () => {
    await render(
      <LineChart
        label="주간 클리어율"
        x={weeks}
        series={[series(1, [10, 20, null, 40]), series(2, [null, 30, 35, null])]}
        formatTick={formatPercent}
        formatValue={formatPercent}
      />
    )

    expect(container.querySelectorAll('path')).toHaveLength(3)
    const lastXs = [...container.querySelectorAll('path')]
      .slice(1)
      .map((path) => path.getAttribute('d')?.match(/[ML]([\d.]+) [\d.]+(?: h0)?$/)?.[1])
    const endXs = [...container.querySelectorAll('[data-chart-end]')].map((end) =>
      Number(end.getAttribute('cx')).toFixed(1)
    )

    expect(endXs).toEqual(lastXs)
    expect(legendNames()).toEqual(['컨텐츠1', '컨텐츠2'])
    expect(container.querySelector('[aria-label="주간 클리어율"]')?.textContent).toContain(
      '2주차, 컨텐츠1 20%, 컨텐츠2 30%'
    )
  })

  it('계열이 하나면 범례를 두지 않는다', async () => {
    await render(
      <LineChart
        label="주간 클리어율"
        x={weeks}
        series={[series(1, [10, 20, 30, 40])]}
        formatTick={formatPercent}
        formatValue={formatPercent}
      />
    )

    expect(legendNames()).toEqual([])
  })

  it('계열에 값이 하나도 없으면 아무것도 그리지 않는다', async () => {
    await render(
      <LineChart
        label="주간 클리어율"
        x={weeks}
        series={[series(1, [null, null, null, null])]}
        formatTick={formatPercent}
        formatValue={formatPercent}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('빈 값으로 그린 뒤 값이 들어오면 그때 차트 크기를 재기 시작한다', async () => {
    const observed: Element[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(element: Element): void {
          observed.push(element)
        }

        disconnect(): void {}
      }
    )
    const empty = [series(1, [null, null, null, null])]
    const filled = [series(1, [10, 20, 30, 40])]

    try {
      await render(
        <LineChart
          label="주간 클리어율"
          x={weeks}
          series={empty}
          formatTick={formatPercent}
          formatValue={formatPercent}
        />
      )
      await render(
        <LineChart
          label="주간 클리어율"
          x={weeks}
          series={filled}
          formatTick={formatPercent}
          formatValue={formatPercent}
        />
      )
    } finally {
      vi.unstubAllGlobals()
    }

    expect(observed).toEqual([container.querySelector('[aria-label="주간 클리어율"]')])
  })
})
