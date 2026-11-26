// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PageNoteTarget } from '#shared/ui/page-note-target'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { ITEM_DETAIL_URL, itemDetailHandlers } from '#widgets/item-tooltip/api/item-detail.handlers'
import { storyItemDetail } from '#widgets/item-tooltip/api/item-detail.fixture'
import { LAB_CURRENCY_ICON_PATH } from './api/lab-items.fixture'
import { LAB_ITEMS_URL, labItemsHandlers } from './api/lab-items.handlers'
import type { LabItemsResponse } from './api/useLabItems'
import { LabEnchantsPage } from './LabEnchantsPage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // 2026-11-26 14:40 KST. 타이머는 그대로 두고 지금 시각만 고정한다.
  vi.useFakeTimers({ now: new Date('2026-11-26T05:40:00.000Z'), toFake: ['Date'] })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function Screen(): React.JSX.Element {
  const [noteTarget, setNoteTarget] = useState<HTMLElement | null>(null)

  return (
    <PageNoteTarget value={noteTarget}>
      <LabEnchantsPage />
      <div data-testid="page-note" ref={setNoteTarget} />
    </PageNoteTarget>
  )
}

async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter path="/lab/enchants">
          <Screen />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

async function renderLoaded(): Promise<void> {
  server.use(labItemsHandlers.items)
  await render()
  await vi.waitFor(() => expect(container.querySelector('table')).not.toBeNull())
}

function enchantTable(): HTMLTableElement {
  return container.querySelector<HTMLTableElement>('table')!
}

function accessoryTable(): HTMLTableElement {
  return container.querySelector<HTMLTableElement>(
    'section[aria-label="칭호, 크리쳐, 오라"] table'
  )!
}

function cellTexts(table: HTMLTableElement): string[][] {
  return [...table.querySelectorAll('tbody tr')].map((row) =>
    [...row.children].map((cell) => cell.textContent ?? '')
  )
}

function nameOf(table: HTMLTableElement, itemName: string): HTMLElement {
  return [...table.querySelectorAll<HTMLElement>('td span')].find(
    (span) => span.textContent === itemName
  )!
}

function roleChip(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('[aria-label="역할"] button')].find(
    (button) => button.textContent === label
  )!
}

it('딜러 마법부여 표는 부위와 등급 칸을 합쳐 한 번만 보이고, 가격은 쉼표를 넣고 매물이 없으면 -로 보인다', async () => {
  await renderLoaded()

  expect(roleChip('딜러').getAttribute('aria-pressed')).toBe('true')
  expect([...enchantTable().querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
    '부위',
    '등급',
    '카드',
    '최저가'
  ])
  expect(cellTexts(enchantTable())).toEqual([
    ['무기', '종결', '멸절의 폭룡왕 바칼 카드', '1,480,000,000'],
    ['준종결', '허망한 맹신, 호스디그 카드', '-'],
    ['합성 무기 보주', '5'],
    ['상의', '종결', '천해천 딜러 상의 카드 (최종 데미지 3%)', '268,000,000'],
    ['준종결', '중천 딜러 상의 카드 (최종 데미지 2%)', '41,500,000']
  ])
  const weapon = enchantTable().querySelector('tbody th')!
  expect(weapon.getAttribute('rowspan')).toBe('3')
})

it('재화로 교환하는 아이템의 가격 칸은 경매장 가격 대신 개수와 그 뒤의 재화 아이콘만 보인다', async () => {
  await renderLoaded()

  const row = nameOf(enchantTable(), '합성 무기 보주').closest('tr')!
  const priceCell = row.querySelector('td:last-child')!
  const icon = priceCell.querySelector('img')!

  expect(priceCell.textContent).toBe('5')
  expect(icon.previousSibling?.textContent).toBe('5')
  expect(icon.getAttribute('src')).toBe(`/api${LAB_CURRENCY_ICON_PATH}`)
  expect(icon.getAttribute('alt')).toBe('합성 교환 주화')
})

it('버퍼로 바꾸면 마법부여 표만 버퍼 카드로 바뀌고 칭호, 크리쳐, 오라 표는 그대로다', async () => {
  await renderLoaded()
  const accessoryRows = [
    ['칭호', '종결', '프로스트의 전설', '95,000,000'],
    ['진정한 각성을 이룬 자', '120,000,000'],
    ['크리쳐', '종결', '운명을 담는 재단사', '54,000,000'],
    ['오라', '종결', '초월한 폭풍의 기세', '-']
  ]
  expect(cellTexts(accessoryTable())).toEqual(accessoryRows)

  await act(async () => roleChip('버퍼').click())

  expect(roleChip('버퍼').getAttribute('aria-pressed')).toBe('true')
  expect(cellTexts(enchantTable())).toEqual([
    ['무기', '종결', '뒤쫓는 자 제논 카드', '612,000,000'],
    ['준종결', '대천사 미카엘 카드', '88,000,000'],
    ['혼돈의 천사 루치펠 카드', '-'],
    ['상의', '종결', '천해천 버퍼 상의 카드 (힘, 지능, 체력, 정신력 +210)', '233,000,000']
  ])
  expect(cellTexts(accessoryTable())).toEqual(accessoryRows)
})

it('이름은 레전더리면 레전더리 색, 등급을 모르면 기본 글자색으로 보인다', async () => {
  await renderLoaded()
  await act(async () => roleChip('버퍼').click())

  expect(nameOf(enchantTable(), '뒤쫓는 자 제논 카드').classList).toContain('text-rarity-legendary')
  expect(nameOf(enchantTable(), '혼돈의 천사 루치펠 카드').classList).toContain('text-fg')
})

it('마지막 업데이트는 마법부여와 칭호 묶음을 통틀어 가장 늦은 확인 시각으로 보인다', async () => {
  const item = (itemName: string, checkedAt: string | null) => ({
    itemName,
    itemId: null,
    itemRarity: null,
    iconPath: null,
    description: null,
    unitPrice: null,
    checkedAt,
    cost: null
  })
  server.use(
    http.get(LAB_ITEMS_URL, () =>
      HttpResponse.json({
        groups: [
          {
            category: 'WEAPON',
            role: 'dealer',
            tier: '종결',
            items: [item('합성 카드 1', '2026-11-26T05:20:00.000Z'), item('합성 카드 2', null)]
          },
          {
            category: 'TITLE',
            role: 'all',
            tier: '종결',
            items: [item('합성 칭호', '2026-11-26T05:35:00.000Z')]
          }
        ]
      } satisfies LabItemsResponse)
    )
  )
  await render()

  const note = container.querySelector('[data-testid="page-note"]')!
  await vi.waitFor(() => expect(note.textContent).toBe('마지막 업데이트 5분 전'))
  expect(note.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-26T05:35:00.000Z')
})

it('받는 중에는 역할 칩 아래에 뼈대를 두고 표는 그리지 않는다', async () => {
  server.use(labItemsHandlers.loading)
  await render()

  expect(roleChip('딜러')).toBeDefined()
  expect(container.querySelector('[aria-busy="true"] .skeleton')).not.toBeNull()
  expect(container.querySelector('table')).toBeNull()
})

it('받지 못하면 역할 칩 아래에 받지 못했다는 한 줄을 보인다', async () => {
  server.use(labItemsHandlers.failure)
  await render()

  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '마법부여 카드를 받지 못했습니다.'
    )
  )
  expect(roleChip('딜러')).toBeDefined()
  expect(container.querySelector('table')).toBeNull()
})

it('묶음이 없으면 역할 칩 없이 카드가 없다는 한 줄만 보인다', async () => {
  server.use(labItemsHandlers.empty)
  await render()

  await vi.waitFor(() => expect(container.textContent).toContain('마법부여 카드가 없습니다.'))
  expect(container.querySelector('[aria-label="역할"]')).toBeNull()
  expect(container.querySelector('table')).toBeNull()
})

function exchangedItems(): LabItemsResponse {
  return {
    groups: [
      {
        category: 'WEAPON',
        role: 'dealer',
        tier: '준종결',
        items: [
          {
            itemName: '합성 보주',
            itemId: 'synthetic-orb',
            itemRarity: '유니크',
            iconPath: null,
            description: null,
            unitPrice: null,
            checkedAt: null,
            cost: {
              currencyName: '합성 주화',
              description: '합성 설명\n둘째 줄',
              count: 5,
              iconPath: LAB_CURRENCY_ICON_PATH
            }
          },
          {
            itemName: '합성 카드',
            itemId: null,
            itemRarity: null,
            iconPath: null,
            description: null,
            unitPrice: null,
            checkedAt: null,
            cost: {
              currencyName: '합성 동전',
              description: null,
              count: 2,
              iconPath: LAB_CURRENCY_ICON_PATH
            }
          }
        ]
      }
    ]
  }
}

async function renderExchanged(requestedItemIds: string[]): Promise<void> {
  server.use(
    http.get(ITEM_DETAIL_URL, ({ params }) => {
      const itemId = String(params.itemId)
      requestedItemIds.push(itemId)

      return HttpResponse.json(storyItemDetail(itemId))
    }),
    http.get(LAB_ITEMS_URL, () => HttpResponse.json(exchangedItems()))
  )
  await render()
  await vi.waitFor(() => expect(container.querySelector('table')).not.toBeNull())
}

// Base UI Tooltip은 trigger의 mouseenter, mouseleave를 직접 듣는다.
async function hover(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('mouseenter'))
  })
}

async function leave(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('mouseleave'))
  })
}

function currencyIconOf(itemName: string): HTMLImageElement {
  return nameOf(enchantTable(), itemName).closest('tr')!.querySelector('td:last-child img')!
}

function openTooltips(): string[] {
  return [...document.querySelectorAll('.tooltip-item')].map((box) => box.textContent ?? '')
}

it('itemId가 있는 아이템 이름에 마우스를 올리면 그 아이템 정보를 tooltip으로 보이고, itemId가 없는 줄에는 tooltip이 없다', async () => {
  const requestedItemIds: string[] = []
  await renderExchanged(requestedItemIds)

  await hover(nameOf(enchantTable(), '합성 카드').parentElement!)
  expect(openTooltips()).toEqual([])

  await hover(nameOf(enchantTable(), '합성 보주').parentElement!)

  await vi.waitFor(() => expect(document.body.textContent).toContain('레벨제한 115'))
  expect(requestedItemIds).toEqual(['synthetic-orb'])
})

it('재화 아이콘에 마우스를 올리면 아이템 정보를 받지 않고 재화 아이콘, 이름, 설명을 보이며, 설명이 없으면 이름만 보인다', async () => {
  const requestedItemIds: string[] = []
  await renderExchanged(requestedItemIds)

  await hover(currencyIconOf('합성 보주'))

  expect(openTooltips()).toEqual(['합성 주화합성 설명\n둘째 줄'])
  const box = document.querySelector('.tooltip-item')!
  expect(box.querySelector('img')?.getAttribute('src')).toBe(`/api${LAB_CURRENCY_ICON_PATH}`)

  await leave(currencyIconOf('합성 보주'))
  await vi.waitFor(() => expect(openTooltips()).toEqual([]))
  await hover(currencyIconOf('합성 카드'))

  expect(openTooltips()).toEqual(['합성 동전'])
  expect(requestedItemIds).toEqual([])
})

it('올린 아이콘이 있으면 Neople 아이콘 대신 같은 origin의 /api 주소로 그리고, 이름과 테두리는 합친 등급 색이다', async () => {
  const iconPath = '/lab/item-icon?itemName=x&v=1'
  server.use(
    http.get(LAB_ITEMS_URL, () =>
      HttpResponse.json({
        groups: [
          {
            category: 'TITLE',
            role: 'all',
            tier: '종결',
            items: [
              {
                itemName: '합성 칭호',
                itemId: 'synthetic-title',
                itemRarity: '유니크',
                iconPath,
                description: null,
                unitPrice: 100,
                checkedAt: null,
                cost: null
              }
            ]
          }
        ]
      } satisfies LabItemsResponse)
    )
  )
  await render()
  await vi.waitFor(() => expect(container.querySelector('table')).not.toBeNull())

  const name = nameOf(accessoryTable(), '합성 칭호')
  const icon = name.parentElement!.querySelector('img')!

  expect(icon.getAttribute('src')).toBe(`/api${iconPath}`)
  expect(icon.classList).toContain('text-rarity-unique')
  expect(name.classList).toContain('text-rarity-unique')
})

it('itemId가 없고 설명이 있는 아이템 이름에 마우스를 올리면 아이템 정보를 받지 않고 아이콘, 등급 색 이름, 설명을 보인다', async () => {
  const requestedItemIds: string[] = []
  const iconPath = '/lab/item-icon?itemName=y&v=2'
  server.use(
    http.get(ITEM_DETAIL_URL, ({ params }) => {
      requestedItemIds.push(String(params.itemId))

      return HttpResponse.json(storyItemDetail(String(params.itemId)))
    }),
    http.get(LAB_ITEMS_URL, () =>
      HttpResponse.json({
        groups: [
          {
            category: 'TITLE',
            role: 'all',
            tier: '종결',
            items: [
              {
                itemName: '합성 상자',
                itemId: null,
                itemRarity: '유니크',
                iconPath,
                description: '합성 설명\n둘째 줄',
                unitPrice: null,
                checkedAt: null,
                cost: null
              }
            ]
          }
        ]
      } satisfies LabItemsResponse)
    )
  )
  await render()
  await vi.waitFor(() => expect(container.querySelector('table')).not.toBeNull())

  await hover(nameOf(accessoryTable(), '합성 상자').parentElement!)

  expect(openTooltips()).toEqual(['합성 상자합성 설명\n둘째 줄'])
  const box = document.querySelector('.tooltip-item')!
  expect(box.querySelector('img')?.getAttribute('src')).toBe(`/api${iconPath}`)
  expect(box.querySelector('b')?.classList).toContain('text-rarity-unique')
  expect(requestedItemIds).toEqual([])
})

it('카드에 마우스를 올리면 아이템 정보 tooltip에 부여 부위와 옵션마다 단계별 값을 묶은 줄을 모험가 명성까지 보이며 딜러 탭에서는 딜러 옵션만 강조하고, 카드가 아니면 보이지 않는다', async () => {
  server.use(itemDetailHandlers.detail)
  await renderLoaded()
  const card = nameOf(enchantTable(), '멸절의 폭룡왕 바칼 카드').parentElement!

  await hover(card)

  await vi.waitFor(() => expect(document.body.textContent).toContain('부여 부위 무기'))

  const rows = [...document.querySelectorAll('.tooltip-item [data-card-option]')]
  const lines = rows.map((row) => [...row.children].map((cell) => cell.textContent).join(' '))
  const emphasized = rows
    .filter((row) => row.firstElementChild?.classList.contains('text-game-enchant'))
    .map((row) => row.firstElementChild?.textContent)
  const separator = rows[0]?.children[2]

  expect(lines).toEqual([
    '모든 속성 강화 13 | 14 | 15',
    '물리 공격력 20 | 25 | 30',
    '마법 공격력 20 | 25 | 30',
    '독립 공격력 20 | 25 | 30',
    '모험가 명성 196 | 196 | 210'
  ])
  expect(emphasized).toEqual(['모든 속성 강화'])
  expect(separator?.classList).toContain('text-fg-subtle')
  expect(separator?.classList).not.toContain('text-game-enchant')

  await leave(card)
  await vi.waitFor(() => expect(document.querySelector('.tooltip-item')).toBeNull())
  await hover(nameOf(accessoryTable(), '프로스트의 전설').parentElement!)

  await vi.waitFor(() => expect(document.body.textContent).toContain('레벨제한 115'))
  expect(document.body.textContent).not.toContain('부여 부위')
})

it('카드 옵션 강조는 고른 역할을 따라, 딜러 탭은 속성 강화를, 버퍼 탭은 올스탯 묶음을 이름과 값 모두 강조한다', async () => {
  const itemId = 'synthetic-dual-card'
  const card = (role: 'dealer' | 'buffer') => ({
    category: 'WEAPON' as const,
    role,
    tier: '종결' as const,
    items: [
      {
        itemName: '합성 양용 카드',
        itemId,
        itemRarity: '유니크',
        iconPath: null,
        description: null,
        unitPrice: 100,
        checkedAt: null,
        cost: null
      }
    ]
  })
  server.use(
    http.get(LAB_ITEMS_URL, () =>
      HttpResponse.json({
        groups: [card('dealer'), card('buffer')]
      } satisfies LabItemsResponse)
    ),
    http.get(ITEM_DETAIL_URL, () =>
      HttpResponse.json({
        ...storyItemDetail(itemId),
        card: {
          slots: ['무기'],
          enchants: [
            {
              upgrade: 0,
              status: [
                { name: '힘', value: '100' },
                { name: '모든 속성 강화', value: '10' }
              ]
            }
          ]
        }
      })
    )
  )
  await render()
  await vi.waitFor(() => expect(container.querySelector('table')).not.toBeNull())

  const emphasizedCells = async () => {
    const name = nameOf(enchantTable(), '합성 양용 카드').parentElement!
    await hover(name)
    await vi.waitFor(() =>
      expect(document.querySelector('.tooltip-item [data-card-option]')).not.toBeNull()
    )
    const cells = [...document.querySelectorAll('.tooltip-item [data-card-option] > span')]
      .filter((cell) => cell.classList.contains('text-game-enchant'))
      .map((cell) => cell.textContent)
    await leave(name)
    await vi.waitFor(() => expect(document.querySelector('.tooltip-item')).toBeNull())

    return cells
  }

  expect(await emphasizedCells()).toEqual(['모든 속성 강화', '10'])

  await act(async () => roleChip('버퍼').click())

  expect(await emphasizedCells()).toEqual(['힘', '100'])
})
