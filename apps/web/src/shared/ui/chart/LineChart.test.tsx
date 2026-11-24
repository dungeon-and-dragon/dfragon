// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LineChart, type LineSeries } from './LineChart'

const PATH_X_PATTERN = /[ML]([\d.]+) /g

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

  it('timeAxis를 넘기면 칸을 칸마다 둔 at 값의 비율로 두고 축 글자는 ticks로 둔다', async () => {
    const timed = [
      { key: 'first', title: '처음', tick: '1주차', at: 0 },
      { key: 'second', title: '중간', tick: null, at: 10 },
      { key: 'third', title: '끝', tick: null, at: 40 }
    ]

    await render(
      <LineChart
        label="명성 추이"
        x={timed}
        series={[series(1, [10, 20, 30])]}
        formatTick={formatPercent}
        formatValue={formatPercent}
        timeAxis={{ min: 0, max: 40, ticks: [{ at: 20, label: '중간' }] }}
      />
    )

    const path = container.querySelector('path')?.getAttribute('d') ?? ''
    const xs = [...path.matchAll(PATH_X_PATTERN)].map((match) => Number(match[1]))
    const [first = 0, second = 0, third = 0] = xs
    const axisTexts = [...container.querySelectorAll('text')].map((text) => text.textContent)

    expect((second - first) / (third - first)).toBeCloseTo(0.25)
    expect(axisTexts).toContain('중간')
    expect(axisTexts).not.toContain('1주차')
  })

  it('selectedKey 칸에 세로선과 빈 점을 두고, fitValues면 0이 아닌 값부터 축을 둔다', async () => {
    await render(
      <LineChart
        label="명성 추이"
        x={weeks.slice(0, 3)}
        series={[series(1, [134000, 135000, 136000])]}
        formatTick={String}
        formatValue={String}
        selectedKey="week-1"
        fitValues
      />
    )

    const path = container.querySelector('path')?.getAttribute('d') ?? ''
    const secondX = [...path.matchAll(PATH_X_PATTERN)].map((match) => match[1])[1]
    const crosshair = [...container.querySelectorAll('line')].find(
      (line) => line.getAttribute('x1') === line.getAttribute('x2')
    )
    const openDots = [...container.querySelectorAll('circle')].filter(
      (circle) => !circle.hasAttribute('data-chart-end')
    )
    const ticks = [...container.querySelectorAll('text')].map((text) => text.textContent)

    expect(Number(crosshair?.getAttribute('x1')).toFixed(1)).toBe(Number(secondX).toFixed(1))
    expect(openDots.map((dot) => Number(dot.getAttribute('cx')).toFixed(1))).toEqual([
      Number(secondX).toFixed(1)
    ])
    expect(ticks).not.toContain('0')
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
