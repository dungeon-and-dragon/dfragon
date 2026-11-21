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
            name: '잔존',
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

  describe('터치 탭', () => {
    const segments = [
      { key: 'both', name: '잔존', value: 76, color: '#000001', textColor: '#ffffff' },
      { key: 'return', name: '복귀', value: 24, color: '#000002', textColor: '#000000' }
    ]

    function pointerDown(target: Element): void {
      target.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })
      )
    }

    // 브라우저는 처음 누른 칸에 호환 mouseenter를 보내고, 이미 손가락 아래 있던 칸에는 보내지 않는다.
    async function tap(target: Element, { entered }: { entered: boolean }): Promise<void> {
      await act(async () => {
        pointerDown(target)
        if (entered) {
          target.dispatchEvent(
            new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })
          )
        }
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
    }

    function dimmedCount(): number {
      return container.querySelectorAll('li.opacity-45').length
    }

    it('칸을 탭하면 값이 열리고, 같은 칸을 다시 탭하면 닫히고, 한 번 더 탭하면 다시 열린다', async () => {
      await render(<SplitBar label="14주차" formatValue={formatNumber} segments={segments} />)
      const both = container.querySelectorAll('li')[0] as Element

      await tap(both, { entered: true })
      expect(dimmedCount()).toBe(1)

      await tap(both, { entered: false })
      expect(dimmedCount()).toBe(0)

      await tap(both, { entered: false })
      expect(dimmedCount()).toBe(1)
    })

    it('값이 열린 뒤 차트 바깥을 누르면 닫힌다', async () => {
      await render(<SplitBar label="14주차" formatValue={formatNumber} segments={segments} />)
      await tap(container.querySelectorAll('li')[0] as Element, { entered: true })
      expect(dimmedCount()).toBe(1)

      await act(async () => pointerDown(document.body))

      expect(dimmedCount()).toBe(0)
    })
  })
})
