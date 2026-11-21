// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { rarityTextClasses } from '#entities/character'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { soulPricesFixture } from './api/soul-prices.fixture'
import { SOUL_PRICES_URL, soulPricesHandlers } from './api/soul-prices.handlers'
import { SoulPriceBox } from './SoulPriceBox'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function render(): Promise<void> {
  return act(async () =>
    root.render(
      <TestQueryClient>
        <SoulPriceBox />
      </TestQueryClient>
    )
  )
}

function settled(): Promise<void> {
  return vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
}

function bodyRows(): string[][] {
  return [...container.querySelectorAll('tbody tr:not([aria-hidden])')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
}

it('소울 결정 6종의 가격, 교환 개수와 가격을 교환 개수로 나눈 1개당 골드를 그리고 매물이 없으면 -로 둔다', async () => {
  server.use(soulPricesHandlers.prices)
  await render()
  await settled()

  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '소울 결정',
    '가격',
    '교환 개수',
    '1개당 골드'
  ])
  // 1,250 / 2 = 625, 3,000 / 4 = 750, 41,000 / 30 = 1,366.7, 140,000 / 90 = 1,555.6, 52,000 / 40 = 1,300
  expect(bodyRows()).toEqual([
    ['레어 소울 결정', '1,250', '2', '625'],
    ['유니크 소울 결정', '3,000', '4', '750'],
    ['레전더리 소울 결정', '41,000', '30', '1,367'],
    ['에픽 소울 결정', '140,000', '90', '1,556'],
    ['태초 소울 결정', '-', '1,000', '-'],
    ['광휘의 소울 결정', '52,000', '40', '1,300']
  ])
  const names = [...container.querySelectorAll('tbody b')]
  expect(names[0]?.className).toBe(rarityTextClasses.rare)
  expect(names[4]?.className).toBe('text-fg')
})

it('받는 중에는 빈 줄 6개를 그린다', async () => {
  server.use(soulPricesHandlers.loading)
  await render()

  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(container.querySelectorAll('tbody tr[aria-hidden]')).toHaveLength(6)
  expect(bodyRows()).toHaveLength(0)
})

it('조회에 실패하면 오류 문구 한 줄을 둔다', async () => {
  server.use(soulPricesHandlers.failure)
  await render()
  await settled()

  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    soulPricesFixture.failureMessage
  )
  expect(container.querySelector('table')).toBeNull()
})

it('응답 모양이 다르면 표 대신 오류 문구를 둔다', async () => {
  server.use(
    http.get(SOUL_PRICES_URL, () =>
      HttpResponse.json({ crystals: [{ itemName: '레어 소울 결정', unitPrice: '1000' }] })
    )
  )
  await render()
  await settled()

  expect(container.querySelector('[role="alert"]')).not.toBeNull()
  expect(container.querySelector('table')).toBeNull()
})
