// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SplitBar } from './SplitBar'

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

describe('SplitBar', () => {
  it('전체의 12%보다 좁은 칸에는 값을 적지 않는다', async () => {
    await render(
      <SplitBar
        label="14주차"
        formatValue={formatNumber}
        segments={[
          {
            key: 'both',
            name: '두 주 모두 클리어',
            value: 76,
            color: '#000001',
            textColor: '#ffffff'
          },
          { key: 'return', name: '복귀', value: 12, color: '#000002', textColor: '#000000' },
          { key: 'first', name: '첫 클리어', value: 11, color: '#000003', textColor: '#000000' },
          { key: 'none', name: '없음', value: 0, color: '#000004', textColor: '#000000' }
        ]}
      />
    )

    const shownLabels = [...container.querySelectorAll('li > span[aria-hidden="true"]')].map(
      (label) => label.textContent
    )

    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(shownLabels).toEqual(['76', '12'])
  })

  it('값의 합이 0이면 아무것도 그리지 않는다', async () => {
    await render(
      <SplitBar
        label="14주차"
        formatValue={formatNumber}
        segments={[{ key: 'none', name: '없음', value: 0, color: '#000004', textColor: '#000000' }]}
      />
    )

    expect(container.innerHTML).toBe('')
  })
})
