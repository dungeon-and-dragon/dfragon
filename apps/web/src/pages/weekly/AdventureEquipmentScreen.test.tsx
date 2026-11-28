// @vitest-environment jsdom
import { delay, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureEquipment, EquipmentCharacter } from '#entities/adventure-guild'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import { OATH_CATALOG_URL, oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { ADVENTURE_EQUIPMENT_URL } from './api/adventure.handlers'
import { AdventureEquipmentScreen } from './AdventureEquipmentScreen'
import type { EquipmentSearch } from './equipment-search'

// 세트 id는 웹의 줄임말 표에 있는 게임 값이다.
const FAIRY = '4ee7bd5912cda6e2a24c1f36d5202b46'
const ONYX = '11f7d203a05ea6f13300c0facb39f11e'

let container: HTMLDivElement
let root: Root
let requests: string[]
let changes: EquipmentSearch[]

beforeEach(() => {
  requests = []
  changes = []
  server.use(oathCatalogHandlers.notUploaded)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function character(
  index: number,
  serverId: EquipmentCharacter['serverId'],
  fame: number,
  equipment: EquipmentCharacter['equipment'] = [],
  oaths: EquipmentCharacter['oaths'] = []
): EquipmentCharacter {
  return {
    serverId,
    characterId: `character-${index}`,
    characterName: `합성${index}`,
    adventureName: '합성 모험단',
    level: 115,
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    jobName: '합성 직업',
    jobGrowName: '眞 합성 전직',
    fame,
    guildId: null,
    guildName: null,
    role: null,
    score: null,
    equipment,
    oaths
  }
}

function holding(setItemId: string, slot: string, rarity: string, count = 1) {
  return {
    setItemId,
    slot,
    rarity,
    itemId: `${slot}-${rarity}`,
    itemName: `${rarity} ${slot}`,
    count
  }
}

const lowFameHoldings = [holding(ONYX, '상의', '에픽')]
const highFameHoldings = [
  holding(ONYX, '상의', '에픽', 2),
  holding(ONYX, '상의', '태초', 2),
  holding(FAIRY, '하의', '레전더리')
]
const highFameOaths: EquipmentCharacter['oaths'] = [
  {
    setItemId: ONYX,
    kind: 'oath',
    rarity: '태초',
    itemId: 'oath-1',
    itemName: '합성 서약',
    count: 1
  },
  {
    setItemId: ONYX,
    kind: 'crystal',
    rarity: '에픽',
    itemId: 'crystal-1',
    itemName: '합성 결정',
    count: 3
  },
  {
    setItemId: ONYX,
    kind: 'crystal',
    rarity: '태초',
    itemId: 'crystal-2',
    itemName: '합성 태초 결정',
    count: 5
  },
  {
    setItemId: ONYX,
    kind: 'crystal',
    rarity: '레전더리',
    itemId: 'crystal-3',
    itemName: '합성 레전더리 결정',
    count: 9
  }
]
const cainCharacters = [
  character(1, 'cain', 100, lowFameHoldings),
  character(2, 'cain', 300, highFameHoldings, highFameOaths)
]
const sirocoCharacter = character(3, 'siroco', 200)

const equipment: AdventureEquipment = {
  adventureName: '합성 모험단',
  sets: [
    { setItemId: ONYX, setItemName: '칠흑의 정화 세트' },
    { setItemId: FAIRY, setItemName: '소울 페어리 세트' },
    { setItemId: 'unlisted-set', setItemName: '가나다 세트' }
  ],
  servers: [
    { serverId: 'cain', characters: cainCharacters },
    { serverId: 'siroco', characters: [] }
  ],
  selected: { serverId: 'cain', setItemId: ONYX }
}
const sirocoFairy: AdventureEquipment = {
  ...equipment,
  servers: [
    { serverId: 'cain', characters: [] },
    { serverId: 'siroco', characters: [sirocoCharacter] }
  ],
  selected: { serverId: 'siroco', setItemId: FAIRY }
}

type Reply = () => Response | Promise<Response>

function serve(reply: Reply): void {
  server.use(
    http.get(ADVENTURE_EQUIPMENT_URL, ({ request }) => {
      requests.push(new URL(request.url).search)

      return reply()
    })
  )
}

function json(body: AdventureEquipment): Reply {
  return () => HttpResponse.json(body)
}

function failure(): Response {
  return HttpResponse.json(
    { error: { code: 'INTERNAL_SERVER_ERROR', message: '합성 오류' } },
    { status: 500 }
  )
}

async function render(search: EquipmentSearch): Promise<void> {
  function change(next: EquipmentSearch): void {
    changes.push(next)
  }

  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <AdventureEquipmentScreen
            adventureName="합성 모험단"
            search={search}
            onSearchChange={change}
            onAdventureOpen={vi.fn()}
          />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

function chips(group: string): [string | null, string | null][] {
  return [...container.querySelectorAll(`[role="group"][aria-label="${group}"] button`)].map(
    (chip) => [chip.textContent, chip.getAttribute('aria-pressed')]
  )
}

function chip(group: string, label: string): HTMLButtonElement {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(`[role="group"][aria-label="${group}"] button`)
  ].find((button) => button.textContent === label)!
}

function tableRows(section: string): string[][] {
  return [...container.querySelectorAll(`section[aria-label="${section}"] table tbody tr`)].map(
    (row) =>
      [...row.querySelectorAll('td')].map(
        (cell) =>
          cell.querySelector('[role="img"]')?.getAttribute('aria-label') ??
          cell.textContent?.trim() ??
          ''
      )
  )
}

function openPopup(): Element | null {
  return document.querySelector('[data-base-ui-portal] [data-open][data-base-ui-focusable]')
}

function tooltipRows(): string[] {
  const rows = openPopup()?.firstElementChild?.children ?? []

  return [...rows].map((row) => row.textContent ?? '')
}

function hover(element: Element): void {
  element.dispatchEvent(new MouseEvent('mouseenter'))
}

async function waitForTable(): Promise<void> {
  await vi.waitFor(() => expect(tableRows('장비').length).toBeGreaterThan(0))
}

const DASHES = Array.from({ length: 10 }, () => '-')

it('응답이 고른 서버와 세트의 칩을 켜고 세트 칩은 응답 순서대로 두며, 표에 없는 세트는 원래 이름으로 보이고, 그 서버 캐릭터를 명성 순으로 보이고, 칸에는 가장 높은 등급과 그 등급의 남은 개수를 보인다', async () => {
  serve(json(equipment))
  await render({})
  await waitForTable()

  expect(requests).toEqual([''])
  expect(chips('서버')).toEqual([
    ['카인', 'true'],
    ['시로코', 'false']
  ])
  expect(chips('세트')).toEqual([
    ['칠흑', 'true'],
    ['페어리', 'false'],
    ['가나다 세트', 'false']
  ])
  expect(tableRows('장비')).toEqual([
    ['합성2합성 전직', '태초 태초 상의', ...DASHES],
    ['합성1합성 전직', '에픽 에픽 상의', ...DASHES]
  ])

  const topRow = container.querySelector('section[aria-label="장비"] table tbody tr')!
  expect(topRow.querySelectorAll('td')[1]?.textContent).toBe('+1')

  expect(tableRows('서약')).toEqual([
    ['합성2합성 전직', '태초 합성 서약', '합성 태초 결정 5개', '합성 결정 3개'],
    ['합성1합성 전직', '-', '-', '-']
  ])
})

it('결정은 아이콘을 3개까지 보이고 남은 개수를 +N으로 보인다', async () => {
  serve(json(equipment))
  await render({})
  await waitForTable()

  const crystalCells = container
    .querySelector('section[aria-label="서약"] table tbody tr')!
    .querySelectorAll('td')
  const primeval = crystalCells[2]!
  const epic = crystalCells[3]!

  expect(primeval.querySelectorAll('img')).toHaveLength(3)
  expect(primeval.textContent).toBe('+2')
  expect(epic.querySelectorAll('img')).toHaveLength(3)
  expect(epic.textContent).toBe('')
})

it('서약 본체 아이콘은 서약 카탈로그의 그림을 쓴다', async () => {
  const oath = {
    ...highFameOaths[0]!,
    rarity: '에픽',
    itemName: '세계를 태우는 용투 서약'
  }
  const top = character(2, 'cain', 300, [], [oath])
  server.use(oathCatalogHandlers.catalog(oathCatalogFixture.characterDetail))
  serve(json({ ...equipment, servers: [{ serverId: 'cain', characters: [top] }] }))
  await render({})

  await vi.waitFor(() =>
    expect(
      container
        .querySelector('section[aria-label="서약"] tbody [role="img"] img')
        ?.getAttribute('src')
    ).toBe('https://skilltab.test/oath-item/epic.webp')
  )
})

it('서약 그림을 먼저 받지 못해도 카탈로그가 늦게 오면 카탈로그 그림을 보인다', async () => {
  const oath = { ...highFameOaths[0]!, rarity: '에픽', itemName: '세계를 태우는 용투 서약' }
  const top = character(2, 'cain', 300, [], [oath])
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })

  server.use(
    http.get(OATH_CATALOG_URL, async () => {
      await released

      return HttpResponse.json(oathCatalogFixture.characterDetail)
    })
  )
  serve(json({ ...equipment, servers: [{ serverId: 'cain', characters: [top] }] }))
  await render({})
  await waitForTable()

  const oathIcon = () =>
    container.querySelector('section[aria-label="서약"] tbody [role="img"] img')
  await act(async () => oathIcon()!.dispatchEvent(new Event('error')))
  expect(oathIcon()).toBeNull()

  await act(async () => release())
  await vi.waitFor(() =>
    expect(oathIcon()?.getAttribute('src')).toBe('https://skilltab.test/oath-item/epic.webp')
  )
})

it('장비 칸과 서약에 마우스를 올리면 태초, 에픽 개수를 따로 보인다', async () => {
  serve(json(equipment))
  await render({})
  await waitForTable()

  const topRow = container.querySelector('section[aria-label="장비"] table tbody tr')!
  await act(async () => hover(topRow.querySelector('[role="img"]')!))
  expect(tooltipRows()).toEqual(['태초2개', '에픽2개'])

  const oathRow = container.querySelector('section[aria-label="서약"] table tbody tr')!
  await act(async () => hover(oathRow.querySelector('[role="img"]')!))
  expect(tooltipRows()).toEqual(['태초1개', '에픽0개'])
})

it('세트 칩을 누르면 지금 서버와 고른 세트를 주소 값으로 넘긴다', async () => {
  serve(json(equipment))
  await render({})
  await waitForTable()

  await act(async () => chip('세트', '페어리').click())

  expect(changes).toEqual([{ server: 'cain', set: FAIRY }])
})

it('주소의 서버와 세트로 요청하고, 그 서버 캐릭터만 행으로 보인다', async () => {
  serve(json(sirocoFairy))
  await render({ server: 'siroco', set: FAIRY })
  await waitForTable()

  expect(requests).toEqual([`?server=siroco&set=${FAIRY}`])
  expect(chips('서버')).toEqual([
    ['카인', 'false'],
    ['시로코', 'true']
  ])
  expect(chips('세트')).toEqual([
    ['칠흑', 'false'],
    ['페어리', 'true'],
    ['가나다 세트', 'false']
  ])
  expect(tableRows('장비')).toEqual([['합성3합성 전직', '-', ...DASHES]])

  await act(async () => chip('서버', '카인').click())

  expect(changes).toEqual([{ server: 'cain', set: FAIRY }])
})

it('주소의 서버나 세트가 응답에 없으면 응답이 고른 서버와 세트의 칩을 켠다', async () => {
  serve(json(sirocoFairy))
  await render({ server: 'bakal', set: 'unknown-set' })
  await waitForTable()

  expect(chips('서버')).toEqual([
    ['카인', 'false'],
    ['시로코', 'true']
  ])
  expect(chips('세트')[1]).toEqual(['페어리', 'true'])
})

it('세트를 바꾸면 그 세트로 한 번 요청하고, 받는 동안 누른 칩을 켜고 앞선 표를 보인다', async () => {
  serve(json(equipment))
  await render({})
  await waitForTable()
  const onyxRows = tableRows('장비')

  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const fairy: AdventureEquipment = {
    ...equipment,
    servers: [
      {
        serverId: 'cain',
        characters: [character(2, 'cain', 300, [holding(FAIRY, '하의', '에픽')])]
      },
      { serverId: 'siroco', characters: [] }
    ],
    selected: { serverId: 'cain', setItemId: FAIRY }
  }

  serve(async () => {
    await released

    return HttpResponse.json(fairy)
  })
  await render({ server: 'cain', set: FAIRY })

  await vi.waitFor(() => expect(requests).toHaveLength(2))
  expect(requests[1]).toBe(`?server=cain&set=${FAIRY}`)
  expect(chip('세트', '페어리').getAttribute('aria-pressed')).toBe('true')
  expect(tableRows('장비')).toEqual(onyxRows)

  await act(async () => release())
  await vi.waitFor(() =>
    expect(tableRows('장비')).toEqual([
      ['합성2합성 전직', '-', '-', '에픽 에픽 하의', ...DASHES.slice(2)]
    ])
  )
  expect(requests).toHaveLength(2)
})

it('서버가 하나인 모험단은 서버 줄을 두지 않는다', async () => {
  serve(json({ ...equipment, servers: [equipment.servers[0]!] }))
  await render({})
  await waitForTable()

  expect(container.querySelector('[role="group"][aria-label="서버"]')).toBeNull()
  expect(chips('세트')).toHaveLength(3)
})

it('받는 중에는 장비 표에 빈 행 4개를 보인다', async () => {
  serve(async () => {
    await delay('infinite')

    return failure()
  })
  await render({})

  await vi.waitFor(() => expect(requests).toHaveLength(1))
  expect(
    container.querySelectorAll('section[aria-label="장비"] tbody tr[aria-hidden="true"]')
  ).toHaveLength(4)
  expect(container.querySelector('[role="group"]')).toBeNull()
})

it('받지 못하면 오류 문구와 다시 시도 버튼을 보이고, 누르면 다시 받아 표를 보인다', async () => {
  serve(failure)
  await render({})

  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('장비를 받지 못했습니다.')
  )
  const retry = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '다시 시도'
  )!

  serve(json(equipment))
  await act(async () => retry.click())
  await waitForTable()

  expect(container.querySelector('[role="alert"]')).toBeNull()
})

it('캐릭터가 없는 모험단은 서버, 세트 줄 없이 빈 상태 한 줄만 보인다', async () => {
  serve(json({ adventureName: '합성 모험단', sets: [], servers: [], selected: null }))
  await render({})

  await vi.waitFor(() =>
    expect(container.querySelector('section[aria-label="장비"] .state')?.textContent).toBe(
      '모험단 캐릭터가 없습니다.'
    )
  )
  expect(container.querySelector('[role="group"]')).toBeNull()
  expect(container.querySelector('section[aria-label="서약"]')).toBeNull()
})
