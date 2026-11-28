// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BarLineChart } from './BarLineChart'
import type { LineSeries } from './LineChart'

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

const integer = new Intl.NumberFormat('ko-KR')

function formatNumber(value: number): string {
  return integer.format(value)
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

describe('BarLineChart', () => {
  const bars = [
    { key: 'again', name: '다시 클리어', color: '#000001', values: [0, 20, 30, 40] },
    { key: 'first', name: '첫 클리어', color: '#000002', values: [10, 5, 0, 8] }
  ]
  const line = series(3, [1, 2, 3, null])
  const formats = {
    barTick: formatNumber,
    barValue: formatNumber,
    lineTick: formatPercent,
    lineValue: formatPercent
  }

  it('범례를 켤 수 있으면 누른 계열 조각을 빼고 마지막 남은 계열은 끄지 않는다', async () => {
    await render(
      <BarLineChart
        label="주차별 클리어"
        x={weeks}
        bars={bars}
        layout="stack"
        formats={formats}
        toggleable
      />
    )

    const pieceCount = () => container.querySelectorAll('[data-chart-bar] path').length
    const [again, first] = [...container.querySelectorAll<HTMLButtonElement>('ul li button')]
    expect(pieceCount()).toBe(6)

    await act(async () => again!.click())
    expect(pieceCount()).toBe(3)
    expect(again!.getAttribute('aria-pressed')).toBe('false')

    await act(async () => first!.click())
    expect(pieceCount()).toBe(3)
    expect(first!.getAttribute('aria-pressed')).toBe('true')

    await act(async () => again!.click())
    expect(pieceCount()).toBe(6)
  })

  it('합으로 정렬하면 켜 둔 계열의 합이 큰 칸부터 두고 범례로 끄면 다시 정렬한다', async () => {
    const named = weeks.map((week) => ({ ...week, tick: week.title }))
    await render(
      <BarLineChart
        label="주차별 클리어"
        x={named}
        bars={bars}
        layout="stack"
        formats={formats}
        toggleable
        sortByTotal
      />
    )

    const ticks = () =>
      [...container.querySelectorAll('svg text[text-anchor="middle"]')].map(
        (tick) => tick.textContent
      )
    expect(ticks()).toEqual(['4주차', '3주차', '2주차', '1주차'])

    const [again] = [...container.querySelectorAll<HTMLButtonElement>('ul li button')]
    await act(async () => again!.click())
    expect(ticks()).toEqual(['1주차', '4주차', '2주차', '3주차'])
  })

  it('비율을 켜면 툴팁에 켜 둔 계열 합 대비 비율을 붙이고 끈 계열은 합에서 뺀다', async () => {
    await render(
      <BarLineChart
        label="주차별 클리어"
        x={weeks}
        bars={bars}
        layout="stack"
        formats={formats}
        toggleable
        barShares
      />
    )

    const hoverWeek = async (index: number) => {
      const hit = container.querySelectorAll('[role="group"] li')[index]!
      await act(async () => {
        hit.dispatchEvent(
          new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })
        )
      })
    }

    const rows = () =>
      [...container.querySelectorAll('[role="group"] > span .text-xs')]
        .filter((row) => row.querySelector('i') != null)
        .map((row) => [...row.querySelectorAll('span')].map((cell) => cell.textContent))

    await hoverWeek(1)
    expect(rows()).toEqual([
      ['다시 클리어', '20', '80.0%'],
      ['첫 클리어', '5', '20.0%']
    ])

    const [again] = [...container.querySelectorAll<HTMLButtonElement>('ul li button')]
    await act(async () => again!.click())
    await hoverWeek(1)
    expect(rows()).toEqual([['첫 클리어', '5', '100.0%']])
  })

  it('범례를 켤 수 없으면 범례에 버튼을 두지 않는다', async () => {
    await render(
      <BarLineChart label="주차별 클리어" x={weeks} bars={bars} layout="stack" formats={formats} />
    )

    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('쌓은 막대는 칸마다 값이 있는 조각만 그리고 고른 칸에 면을 깐다', async () => {
    await render(
      <BarLineChart
        label="주차별 클리어"
        x={weeks}
        bars={bars}
        layout="stack"
        line={line}
        selectedKey="week-3"
        formats={formats}
      />
    )

    const barPaths = [...container.querySelectorAll('[data-chart-bar]')].map(
      (bar) => bar.querySelectorAll('path').length
    )

    expect(barPaths).toEqual([1, 2, 1, 2])
    const selected = container.querySelector('rect')
    const selectedLeft = Number(selected?.getAttribute('x'))
    const selectedRight = selectedLeft + Number(selected?.getAttribute('width'))
    const barLefts = [...container.querySelectorAll('[data-chart-bar]')].map((bar) =>
      Number(
        bar
          .querySelector('path')
          ?.getAttribute('d')
          ?.match(/^M([\d.]+)/)?.[1]
      )
    )

    expect(container.querySelectorAll('rect')).toHaveLength(1)
    expect(barLefts.map((left) => left > selectedLeft && left < selectedRight)).toEqual([
      false,
      false,
      false,
      true
    ])
    expect(container.querySelectorAll('[data-chart-end]')).toHaveLength(1)
    expect(legendNames()).toEqual(['다시 클리어', '첫 클리어', '컨텐츠3'])
  })

  it('막대와 선에 값이 모두 없으면 아무것도 그리지 않는다', async () => {
    await render(
      <BarLineChart
        label="주차별 클리어"
        x={weeks}
        bars={bars.map((bar) => ({ ...bar, values: [0, 0, 0, 0] }))}
        layout="overlap"
        line={series(3, [null, null, null, null])}
        formats={formats}
      />
    )

    expect(container.innerHTML).toBe('')
  })
})
