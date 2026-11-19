// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BoxPlot, BoxPlotChart } from './BoxPlot'
import { niceScale } from './chart-geometry'

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

describe('BoxPlot', () => {
  const stats = { p5: 110000, p25: 120000, median: 124000, p75: 128000, p95: 132000, max: 136000 }

  it('줄 안 형태는 넘겨받은 폭과 축으로 그려 같은 열의 줄이 같은 눈금 위치를 쓴다', async () => {
    const scale = niceScale(100000, 140000, 4)

    await render(
      <div>
        <BoxPlot stats={stats} color="#000001" scale={scale} width={460} />
        <BoxPlot
          stats={{ ...stats, p5: 104000, max: 139000 }}
          color="#000001"
          scale={scale}
          width={460}
        />
      </div>
    )

    const [first, second] = [...container.querySelectorAll('svg')]
    function gridXs(svg: SVGSVGElement | undefined): string[] {
      return [...(svg?.querySelectorAll('line') ?? [])]
        .filter((line) => line.getAttribute('y1') === '0')
        .map((line) => line.getAttribute('x1') ?? '')
    }

    expect(first?.getAttribute('width')).toBe('460')
    expect(gridXs(first)).toHaveLength(scale.ticks.length)
    expect(gridXs(second)).toEqual(gridXs(first))
  })

  it('여러 줄 형태는 줄마다 box plot을 그리고 모든 줄 아래에 축 하나를 둔다', async () => {
    await render(
      <BoxPlotChart
        label="클리어 캐릭터의 명성"
        rows={[
          { key: 'hard', name: '컨텐츠', sub: '하드', color: '#000001', stats },
          { key: 'normal', name: '컨텐츠', sub: '일반', color: '#000002', faded: true, stats }
        ]}
        formatTick={formatNumber}
        formatValue={formatNumber}
      />
    )

    const rowPlots = [...container.querySelectorAll('li svg')]
    const axisTicks = [...container.querySelectorAll('svg text')].map((text) => text.textContent)

    expect(rowPlots).toHaveLength(2)
    expect(rowPlots.map((plot) => plot.querySelectorAll('rect').length)).toEqual([1, 1])
    expect(axisTicks.length).toBeGreaterThan(1)
    expect(axisTicks).toContain('110,000')
  })

  it('여러 줄 형태는 줄이 없으면 아무것도 그리지 않는다', async () => {
    await render(
      <BoxPlotChart
        label="클리어 캐릭터의 명성"
        rows={[]}
        formatTick={formatNumber}
        formatValue={formatNumber}
      />
    )

    expect(container.innerHTML).toBe('')
  })
})
