// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Sankey, type SankeyFlow } from './Sankey'

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

async function render(flows: readonly SankeyFlow[]): Promise<void> {
  await act(async () =>
    root.render(
      <Sankey
        label="지난주 대비 이동"
        sourceTitle="13주차"
        targetTitle="14주차"
        sources={[
          { key: 'hard', name: '하드', color: '#000001' },
          { key: 'first', name: '신규', color: '#000002' }
        ]}
        targets={[
          { key: 'hard', name: '하드', color: '#000001' },
          { key: 'left', name: '이탈', color: '#000003' }
        ]}
        flows={flows}
        formatValue={String}
      />
    )
  )
}

const flow = (from: string, to: string, value: number): SankeyFlow => ({
  key: `${from}-${to}`,
  name: `${from} → ${to}`,
  from,
  to,
  value,
  color: '#000004'
})

describe('Sankey', () => {
  it('값이 0인 흐름과 흐름이 없는 노드는 그리지 않는다', async () => {
    await render([flow('hard', 'hard', 7), flow('hard', 'left', 3), flow('first', 'hard', 0)])

    const labels = [...container.querySelectorAll('svg text')].map((text) => text.textContent)

    expect(container.querySelectorAll('svg path')).toHaveLength(2)
    expect(labels).toEqual(['13주차', '14주차', '하드', '10', '하드', '7', '이탈', '3'])
  })

  it('흐름에 마우스를 올리면 그 흐름만 진하게 두고 이름과 값을 보인다', async () => {
    await render([flow('hard', 'hard', 7), flow('hard', 'left', 3)])

    const [kept, left] = [...container.querySelectorAll<SVGPathElement>('svg path')]
    await act(async () => {
      left?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })

    expect(Number(left?.style.opacity)).toBeGreaterThan(Number(kept?.style.opacity))
    expect(container.querySelector('[aria-hidden="true"].shadow-popover')?.textContent).toBe(
      'hard → left3'
    )
  })

  it('작은 노드가 붙어 있어도 노드 이름 라벨끼리 32px 이상 떨어뜨린다', async () => {
    await act(async () =>
      root.render(
        <Sankey
          label="지난주 대비 이동"
          sourceTitle="13주차"
          targetTitle="14주차"
          sources={[
            { key: 'hard', name: '하드', color: '#000001' },
            { key: 'returned', name: '복귀', color: '#000002' },
            { key: 'first', name: '신규', color: '#000003' }
          ]}
          targets={[{ key: 'hard', name: '하드', color: '#000001' }]}
          flows={[
            flow('hard', 'hard', 1000),
            flow('returned', 'hard', 1),
            flow('first', 'hard', 1)
          ]}
          formatValue={String}
        />
      )
    )

    const nameY = (name: string) =>
      Number(
        [...container.querySelectorAll('svg text')]
          .find((text) => text.textContent === name)
          ?.getAttribute('y')
      )

    expect(nameY('신규') - nameY('복귀')).toBeGreaterThanOrEqual(32)
  })

  it('모든 흐름이 0이면 아무것도 그리지 않는다', async () => {
    await render([flow('hard', 'hard', 0)])

    expect(container.innerHTML).toBe('')
  })
})
