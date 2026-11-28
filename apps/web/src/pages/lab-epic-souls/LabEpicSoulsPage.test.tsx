// @vitest-environment jsdom
import { equipmentVariantsOf } from '@dfragon/lib/equipment-variants'
import { delay, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMyAdventureStore } from '#entities/adventure-guild'
import { fromBase64Url } from '#shared/lib/base64url'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { GOLDEN_SET, storyRecoveries } from './api/epic-souls.fixture'
import { EPIC_SOUL_RECOVERY_URL, epicSoulsHandlers } from './api/epic-souls.handlers'
import { LabEpicSoulsPage } from './LabEpicSoulsPage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  useMyAdventureStore.setState({ adventureName: null })
})

afterEach(async () => {
  server.events.removeAllListeners()
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter path="/lab/epic-souls">
          <LabEpicSoulsPage />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

async function search(name = '모험단1'): Promise<void> {
  const form = container.querySelector<HTMLFormElement>('form')!
  const input = form.querySelector<HTMLInputElement>('input[aria-label="모험단"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => form.requestSubmit())
}

function characterRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('table > tbody > tr')].filter(
    (row) => row.querySelector('td[colspan]') === null
  )
}

function rowText(row: HTMLTableRowElement): string[] {
  return [...row.cells].slice(1).map((cell) => cell.textContent ?? '')
}

function totalText(): string | null | undefined {
  return container.querySelector('tfoot td.table-num')?.textContent
}

function simulatorLinks(): HTMLAnchorElement[] {
  return [...container.querySelectorAll<HTMLAnchorElement>('a')].filter(
    (link) => link.textContent === '시뮬레이터'
  )
}

function changesOf(link: HTMLAnchorElement) {
  const changes = new URL(link.href, 'https://dfragon.test').searchParams.get('changes')!

  return JSON.parse(fromBase64Url(changes))
}

async function waitForRecoveries(): Promise<void> {
  await vi.waitFor(() => expect(container.querySelector('.skeleton')).toBeNull())
}

const recoveries = storyRecoveries(false)

it('검색 전에는 검색 폼만 두고 체크박스와 표를 그리지 않는다', async () => {
  await render()

  expect(container.querySelector('input[aria-label="모험단"]')).not.toBeNull()
  expect(container.querySelector('[role="checkbox"]')).toBeNull()
  expect(container.querySelector('table')).toBeNull()
})

it('모험단 탭에서 저장한 모험단이 있으면 검색 폼에 넣고 검색 없이 그 모험단의 캐릭터를 그린다', async () => {
  useMyAdventureStore.setState({ adventureName: '모험단1' })
  server.use(epicSoulsHandlers.characters, epicSoulsHandlers.recoveriesLoading)
  await render()

  await vi.waitFor(() => expect(characterRows()).toHaveLength(6))
  expect(container.querySelector<HTMLInputElement>('input[aria-label="모험단"]')!.value).toBe(
    '모험단1'
  )
})

it('검색한 모험단은 모험단 탭이 쓰는 저장 모험단으로 바꾼다', async () => {
  useMyAdventureStore.setState({ adventureName: '모험단1' })
  server.use(epicSoulsHandlers.noAdventure)
  await render()
  await search('모험단2')

  expect(useMyAdventureStore.getState().adventureName).toBe('모험단2')
})

it('캐릭터 줄은 목록을 받자마자 그리고, 회수 응답이 오기 전에는 에픽 소울 칸을 뼈대로 둔다', async () => {
  server.use(epicSoulsHandlers.characters, epicSoulsHandlers.recoveriesLoading)
  await render()
  await search()

  await vi.waitFor(() => expect(characterRows()).toHaveLength(6))
  for (const row of characterRows()) {
    expect(row.cells[2]?.querySelector('.skeleton')).not.toBeNull()
  }
  expect(container.querySelector('[role="checkbox"]')?.getAttribute('aria-checked')).toBe('false')
})

it('한 캐릭터를 계산하지 못해도 다른 줄을 채우고, 합계는 받은 줄의 에픽 소울을 더한다', async () => {
  server.use(epicSoulsHandlers.characters, epicSoulsHandlers.recoveries)
  await render()
  await search()
  await waitForRecoveries()

  const rows = characterRows()
  expect(rowText(rows[0]!)[1]).toBe(String(recoveries[0]!.souls.total))
  expect(rowText(rows[3]!).slice(1)).toEqual(['-', '계산하지 못했습니다.'])
  expect(rowText(rows[5]!).slice(1)).toEqual(['0', ''])
  expect(rows[5]!.querySelector('button')).toBeNull()
  expect(simulatorLinks()).toHaveLength(4)
  // 계산하지 못한 넷째 캐릭터를 빼고 226 + 21 + 67 + 11 + 0이다.
  expect(totalText()).toBe('325')
})

it('줄을 펼치면 에픽 부위마다 현재 장비와 조율, 변경 후 장비, 에픽 소울을 보이고 무기는 계열 이름으로 부른다', async () => {
  server.use(epicSoulsHandlers.characters, epicSoulsHandlers.recoveries)
  await render()
  await search()
  await waitForRecoveries()

  const toggle = container.querySelector<HTMLButtonElement>(
    'button[aria-label="캐릭터1 부위별 에픽 소울"]'
  )!
  const goldenLegendaryJacket = equipmentVariantsOf(GOLDEN_SET, 'JACKET').find(
    ({ rarity, kind }) => rarity === '레전더리' && kind === '일반'
  )!.item
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  await act(async () => toggle.click())

  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  const slotRows = [...container.querySelectorAll<HTMLTableRowElement>('td[colspan] tbody tr')]
  const [weapon, jacket] = slotRows.map((row) =>
    [...row.cells].map((cell) => cell.textContent ?? '')
  )
  expect(slotRows).toHaveLength(recoveries[0]!.souls.slots.length)
  expect(weapon).toEqual(['무기', '레거시III', '태초의 별', '46'])
  expect(jacket).toEqual(['상의', '칠흑의 정화 상의III', goldenLegendaryJacket.itemName, '31'])
})

it('시뮬레이터 링크는 최고 세팅의 세트와 에픽 부위의 변경 후 장비, 착용 강화와 증폭을 담는다', async () => {
  server.use(epicSoulsHandlers.characters, epicSoulsHandlers.recoveries)
  await render()
  await search()
  await waitForRecoveries()

  const [first] = simulatorLinks()
  const changes = changesOf(first!)
  const recovery = recoveries[0]!
  const jacket = recovery.souls.slots.find(({ slotId }) => slotId === 'JACKET')!

  expect(first!.pathname).toBe('/c/cain/story-character-1/simulator')
  expect(changes.equipmentSet).toBe(GOLDEN_SET)
  expect(Object.keys(changes.equipment)).toEqual(recovery.souls.slots.map(({ slotId }) => slotId))
  expect(changes.equipment.WEAPON.variantId).toBe(recovery.best!.weaponVariantId)
  expect(changes.equipment.JACKET).toEqual({
    reinforce: jacket.before.reinforce,
    amplified: jacket.before.amplified,
    enchantId: null,
    variantId: jacket.after!.itemId,
    tune: 0,
    potency: null,
    release: null
  })
})

it('체크박스를 켜면 모든 줄을 태초 포함으로 다시 받아 악세서리 링크가 태초 장비로 바뀐다', async () => {
  const bodies: unknown[] = []
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST') {
      bodies.push(await request.clone().json())
    }
  })
  server.use(epicSoulsHandlers.characters, epicSoulsHandlers.recoveries)
  await render()
  await search()
  await waitForRecoveries()
  const primordialAmulet = equipmentVariantsOf(GOLDEN_SET, 'AMULET').find(
    ({ rarity, kind }) => rarity === '태초' && kind === '일반'
  )!

  await act(async () => container.querySelector<HTMLElement>('[role="checkbox"]')!.click())
  await waitForRecoveries()

  expect(
    bodies.filter((body) => (body as { includePrimordial: boolean }).includePrimordial)
  ).toHaveLength(6)
  expect(changesOf(simulatorLinks()[0]!).equipment.AMULET.variantId).toBe(primordialAmulet.id)
})

it('모험단 캐릭터가 없으면 모험단을 찾지 못했다고 보인다', async () => {
  server.use(epicSoulsHandlers.noAdventure)
  await render()
  await search('없는모험단')

  await vi.waitFor(() => expect(container.textContent).toContain('모험단을 찾지 못했습니다.'))
  expect(container.querySelector('table')).toBeNull()
})

it('모험단 캐릭터 목록을 받지 못하면 받지 못했다고 보인다', async () => {
  server.use(epicSoulsHandlers.charactersFailure)
  await render()
  await search()

  await vi.waitFor(() =>
    expect(container.textContent).toContain('모험단 캐릭터를 받지 못했습니다.')
  )
})

it('회수 요청은 한 번에 하나씩 보낸다', async () => {
  let inFlight = 0
  let maxInFlight = 0
  server.use(
    epicSoulsHandlers.characters,
    http.post(EPIC_SOUL_RECOVERY_URL, async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await delay(5)
      inFlight -= 1

      return HttpResponse.json(storyRecoveries(false)[0])
    })
  )
  await render()
  await search()
  await waitForRecoveries()

  expect(maxInFlight).toBe(1)
})
