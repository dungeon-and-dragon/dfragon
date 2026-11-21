// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { raritySolidClasses } from '#entities/character'
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

it('소울 결정 6종의 가격과 그 가격을 종말의 계시 교환 개수로 나눈 계시 환산 값을 그리고 결정은 이름 대신 아이템 아이콘으로 보인다', async () => {
  server.use(soulPricesHandlers.prices)
  await render()
  await settled()

  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '소울 결정',
    '가격',
    '계시 환산'
  ])
  expect(container.querySelector('thead th:first-child .sr-only')?.textContent).toBe('소울 결정')
  // 1,250 / 2 = 625, 3,000 / 4 = 750, 41,000 / 30 = 1,366.7, 140,000 / 90 = 1,555.6, 2,000,000 / 1,000 = 2,000, 52,000 / 40 = 1,300
  expect(bodyRows()).toEqual([
    ['레어 소울 결정', '1,250', '625'],
    ['유니크 소울 결정', '3,000', '750'],
    ['레전더리 소울 결정', '41,000', '1,367'],
    ['에픽 소울 결정', '140,000', '1,556'],
    ['태초 소울 결정', '2,000,000', '2,000'],
    ['광휘의 소울 결정', '52,000', '1,300']
  ])
  const iconCells = [...container.querySelectorAll('tbody tr td:first-child')]
  expect(iconCells.map((cell) => cell.querySelector('[title]')?.getAttribute('title'))).toEqual(
    soulPricesFixture.crystals.map(({ itemName }) => itemName)
  )
  expect(iconCells[0]?.querySelector('img')?.getAttribute('src')).toBe(
    'https://img-api.neople.co.kr/df/items/c4816db14d145416921f0210063cb014'
  )
  expect(iconCells[0]?.querySelector('img')?.classList).toContain(raritySolidClasses.rare)
})

it('매물이 없는 결정은 가격과 계시 환산 값을 -로, 아이콘을 빈 칸으로 둔다', async () => {
  server.use(
    http.get(SOUL_PRICES_URL, () =>
      HttpResponse.json({
        crystals: [
          {
            itemId: null,
            itemName: '태초 소울 결정',
            itemRarity: null,
            unitPrice: null,
            revelationCount: 1000
          }
        ]
      })
    )
  )
  await render()
  await settled()

  expect(bodyRows()).toEqual([['태초 소울 결정', '-', '-']])
  const iconCell = container.querySelector('tbody tr td:first-child')
  expect(iconCell?.querySelector('[title]')?.getAttribute('title')).toBe('태초 소울 결정')
  expect(iconCell?.querySelector('img')).toBeNull()
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
