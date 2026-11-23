// @vitest-environment jsdom
import { enchantOptionsOf } from '@dfragon/lib/enchant-grades'
import { slotItemsOf } from '@dfragon/lib/slot-items'
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterCardScore, CharacterDetailView } from '#entities/character'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import {
  apiFailure,
  characterUrl,
  loadingResponse
} from '#entities/character-detail/api/character-detail.handlers'
import { server } from '#testing/test-support/msw-server'
import { toneClassesOf } from '#testing/test-support/score-tone-class'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { storyItemDetail } from '#widgets/item-tooltip/api/item-detail.fixture'
import { ITEM_DETAIL_URL, itemDetailHandlers } from '#widgets/item-tooltip/api/item-detail.handlers'
import { simulationScore } from './api/simulation.fixture'
import { simulationUrl } from './api/simulation.handlers'
import { CharacterSimulatorScreen } from './CharacterSimulatorScreen'
import type { SimulationBody } from './model/simulator-draft'

type Respond = (body: SimulationBody) => Response | Promise<Response>

const BASELINE = 1_000_000

let container: HTMLDivElement
let root: Root
let bodies: SimulationBody[]

beforeEach(() => {
  bodies = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function identityOf({ character }: CharacterDetailView) {
  return { serverId: character.serverId, characterId: character.characterId }
}

function score(value: number, calculator: CharacterCardScore['calculator'] = 'equipment') {
  return simulationScore(calculator, { value })
}

const SLOT_ITEM_POINTS = 1_000

// 바꾼 부위의 강화 수치 합과 고른 칭호, 크리쳐, 오라마다 1,000점을 더해, 어떤 요청에 대한 응답인지 화면 숫자로 구분한다.
function scoresFor({ equipment, ...slotItems }: SimulationBody): Response {
  const reinforced = equipment.reduce((sum, { reinforce }) => sum + reinforce, 0)
  const added = reinforced + Object.keys(slotItems).length * SLOT_ITEM_POINTS

  return HttpResponse.json({ baseline: score(BASELINE), simulated: score(BASELINE + added) })
}

async function render(
  detail: CharacterDetailView,
  respond: Respond = scoresFor,
  detailResponse: () => Response | Promise<void> = () => HttpResponse.json(detail)
): Promise<void> {
  const identity = identityOf(detail)
  server.use(
    http.get(characterUrl(identity), detailResponse),
    http.post(simulationUrl(identity), async ({ request }) => {
      const body = (await request.json()) as SimulationBody
      bodies.push(body)

      return respond(body)
    })
  )
  await act(async () =>
    root.render(
      <TestRouter>
        <TestQueryClient>
          <CharacterSimulatorScreen
            serverId={identity.serverId}
            characterId={identity.characterId}
          />
        </TestQueryClient>
      </TestRouter>
    )
  )
}

function control(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`)
  expect(found, label).not.toBeNull()

  return found!
}

async function pick(label: string, option: string): Promise<void> {
  await act(async () => control(label).click())
  const item = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((candidate) =>
    candidate.textContent?.startsWith(option)
  )
  expect(item, option).toBeDefined()
  await act(async () => item!.click())
}

function reinforceOf(slotLabel: string): string {
  return (control(`${slotLabel} 수치`) as HTMLInputElement).value
}

async function step(label: string, times: number): Promise<void> {
  for (let count = 0; count < times; count++) {
    await act(async () => control(label).click())
  }
}

function panel(label = '장비 점수'): HTMLElement {
  return container.querySelector<HTMLElement>(`section[aria-label="${label}"]`)!
}

function scoreRows(label?: string): string[][] {
  return [...panel(label).querySelectorAll('dl > div')].map((row) => [
    row.querySelector('dt')!.textContent ?? '',
    row.querySelector('dd')!.firstChild?.textContent ?? ''
  ])
}

function scoreValue(rowLabel: string, label?: string): HTMLElement {
  const row = [...panel(label).querySelectorAll('dl > div')].find(
    (candidate) => candidate.querySelector('dt')?.textContent === rowLabel
  )

  return row!.querySelector('dd')!
}

function resetButton(): HTMLButtonElement {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '초기화'
  )!
}

async function waitForScores(rows: string[][], label?: string): Promise<void> {
  await expect
    .poll(() => panel(label) !== null && scoreRows(label), { timeout: 2_000 })
    .toEqual(rows)
}

it('열면 착용한 장비의 수치, 증폭, 마법부여를 기본값으로 두고 바꾼 것 없이 원본 점수를 받는다', async () => {
  await render(characterDetailFixture('dealer'))

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])
  expect(bodies).toEqual([{ equipment: [] }])
  expect(reinforceOf('무기')).toBe('+10')
  expect(control('무기 증폭').getAttribute('aria-checked')).toBe('false')
  expect(reinforceOf('귀걸이')).toBe('+8')
  expect(control('상의 수치 내리기').hasAttribute('disabled')).toBe(true)
  expect(control('상의 수치 올리기').hasAttribute('disabled')).toBe(false)
  expect(control('귀걸이 증폭').getAttribute('aria-checked')).toBe('true')
  expect(control('무기 마법부여').textContent).toBe('화속성 강화 +15, 명속성 강화 +15')
  expect(container.querySelector('[aria-label="칭호 수치"]')).toBeNull()
  expect(toneClassesOf(scoreValue('변경 후'))).toEqual(['dealer'])
  expect(resetButton().disabled).toBe(true)
})

it('값을 바꾸면 바꾼 부위의 상태 전체를 요청하고 오른쪽 점수와 차이를 새 결과로 바꾼다', async () => {
  const [amuletOption] = enchantOptionsOf('AMULET', 'dealer').종결
  await render(characterDetailFixture('dealer'))
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  await step('무기 수치 올리기', 2)
  await act(async () => control('무기 증폭').click())
  await pick('목걸이 마법부여', '최종 데미지 증가 +2%')

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,012'],
    ['차이', '+12']
  ])
  expect(bodies.at(-1)).toEqual({
    equipment: [
      { slotId: 'WEAPON', reinforce: 12, amplified: true, enchantId: null },
      { slotId: 'AMULET', reinforce: 0, amplified: false, enchantId: amuletOption!.id }
    ]
  })
  expect(reinforceOf('무기')).toBe('+12')
  expect(scoreValue('차이').className).toContain('text-fg-success')
  expect(resetButton().disabled).toBe(false)
})

it('초기화하면 모든 부위를 착용한 값으로 되돌리고 원본 점수를 다시 보인다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])
  await step('무기 수치 올리기', 5)
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,015'],
    ['차이', '+15']
  ])

  await act(async () => resetButton().click())

  expect(reinforceOf('무기')).toBe('+10')
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])
  expect(resetButton().disabled).toBe(true)
})

it('늦게 온 앞 요청의 응답은 지금 값의 점수를 덮지 않는다', async () => {
  let answerLate: (() => void) | undefined
  await render(characterDetailFixture('dealer'), (body) => {
    if (body.equipment[0]?.reinforce !== 12) {
      return scoresFor(body)
    }

    return new Promise((resolve) => {
      answerLate = () => resolve(scoresFor(body))
    })
  })
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  await step('무기 수치 올리기', 2)
  await expect.poll(() => answerLate).toBeDefined()
  await step('무기 수치 올리기', 1)
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,013'],
    ['차이', '+13']
  ])
  await act(async () => answerLate!())

  await expect
    .poll(() => scoreRows())
    .toEqual([
      ['현재', '1,000,000'],
      ['변경 후', '1,000,013'],
      ['차이', '+13']
    ])
})

it('엔진이 없어 두 점수가 모두 없으면 계산할 수 없다는 한 줄만 보인다', async () => {
  await render(characterDetailFixture('dealer'), () =>
    HttpResponse.json({ baseline: null, simulated: null })
  )

  await expect.poll(() => panel()?.textContent).toBe('장비 점수점수를 계산할 수 없습니다.')
})

it('엔진이 지원하지 않는 변경은 바꾼 뒤 점수와 차이를 비우고 이유를 보조 기술에 읽힌다', async () => {
  const skipped = { kind: 'simulation', message: 'unsupported' }
  await render(characterDetailFixture('dealer'), () =>
    HttpResponse.json({
      baseline: score(BASELINE),
      simulated: simulationScore('equipment', { value: null, skipped })
    })
  )

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '-'],
    ['차이', '-']
  ])
  expect(scoreValue('변경 후').querySelector('.sr-only')?.textContent).toBe(
    '계산하지 못함, 바꾼 장비를 계산하지 못함'
  )
})

it('근사값은 ≈를 붙이고 점선 밑줄로 보이며 차이에도 ≈를 붙인다', async () => {
  const skipped = { kind: 'input_gate', message: 'gate' }
  const approximate = { value: BASELINE + 500, source: 'input_gate_diagnostic', warning: 'w' }
  await render(characterDetailFixture('dealer'), () =>
    HttpResponse.json({
      baseline: score(BASELINE),
      simulated: simulationScore('equipment', { value: null, skipped, approximate })
    })
  )

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '≈1,000,500'],
    ['차이', '≈+500']
  ])
  expect(scoreValue('변경 후').className).toContain('border-dotted')
})

it.each([
  ['400 잘못된 요청', () => apiFailure(400, 'INVALID_SIMULATION_REQUEST', '잘못된 요청')],
  ['500 서버 오류', () => apiFailure(500, 'INTERNAL_SERVER_ERROR', '서버 오류')]
])('계산 요청이 %s로 실패하면 점수 대신 오류 한 줄을 보인다', async (_name, respond) => {
  await render(characterDetailFixture('dealer'), respond)

  await expect
    .poll(() => panel()?.querySelector('[role="alert"]')?.textContent)
    .toBe('점수를 계산하지 못했습니다.')
  expect(panel().querySelector('dl')).toBeNull()
})

it('버퍼는 버프 점수 라벨과 버퍼 색으로 보인다', async () => {
  await render(characterDetailFixture('buffer'), () =>
    HttpResponse.json({ baseline: score(4_000, 'buff'), simulated: score(4_100, 'buff') })
  )

  await waitForScores(
    [
      ['현재', '4,000'],
      ['변경 후', '4,100'],
      ['차이', '+100']
    ],
    '버프 점수'
  )
  expect(toneClassesOf(scoreValue('현재', '버프 점수'))).toEqual(['buffer'])
})

function slotNames(): string[] {
  return [...container.querySelectorAll('tbody tr')].map(
    (row) => row.querySelector('td')?.textContent ?? ''
  )
}

function iconsIn(element: Element): (string | null)[] {
  return [...element.querySelectorAll('img')].map((image) => image.getAttribute('src'))
}

function iconUrl(itemId: string | null): string {
  return `https://img-api.neople.co.kr/df/items/${itemId}`
}

function option(name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent === name
  )
  expect(found, name).toBeDefined()

  return found!
}

it('칭호는 무기 다음 자리에, 크리쳐와 오라는 장비 뒤에 두고 장비 칸의 선택에 착용한 아이템의 아이콘과 이름을 보인다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  const names = slotNames()
  expect(names.slice(0, 3)).toEqual(['무기', '칭호', '상의'])
  expect(names.slice(-2)).toEqual(['크리쳐', '오라'])
  expect(container.querySelectorAll('tbody tr')[1]!.textContent).toContain(
    '프로스트의 전설 플래티넘[35Lv]'
  )
  const titleRow = container.querySelectorAll('tbody tr')[1]!
  const worn = characterDetailFixture('dealer').equipment.equipment[1]!
  const titleControl = control('칭호 교체')
  expect(titleControl.textContent).toBe('프로스트의 전설 플래티넘[35Lv]')
  expect(iconsIn(titleControl)).toEqual([iconUrl(worn.itemId)])
  expect(titleRow.querySelectorAll('td')[1]!.contains(titleControl)).toBe(true)
  expect([...titleRow.querySelectorAll('td')].slice(2).map((cell) => cell.textContent)).toEqual([
    '',
    ''
  ])
  expect(control('크리쳐 교체').textContent).toBe('운명을 담는 재단사')
  expect(control('오라 교체').textContent).toBe('고결한 영혼의 잔상')

  await act(async () => control('칭호 교체').click())
  const options = [...document.querySelectorAll('[role="option"]')]
  expect(options.map((item) => item.textContent)).toEqual([
    '프로스트의 전설 플래티넘[35Lv]',
    ...slotItemsOf('title').map(({ name }) => name)
  ])
  expect(options.map((item) => iconsIn(item))).toEqual([
    [iconUrl(worn.itemId)],
    ...slotItemsOf('title').map(({ item }) => [iconUrl(item.itemId)])
  ])
})

it('목록 항목의 아이콘에 마우스를 올리면 그 아이템의 정보를 tooltip으로 보인다', async () => {
  const [titleItem] = slotItemsOf('title')
  const requestedItemIds: string[] = []
  await render(characterDetailFixture('dealer'))
  server.use(
    http.get(ITEM_DETAIL_URL, ({ params }) => {
      const itemId = String(params.itemId)
      requestedItemIds.push(itemId)

      return HttpResponse.json(storyItemDetail(itemId))
    })
  )
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])
  await act(async () => control('칭호 교체').click())
  const icon = option(titleItem!.name).querySelector('img')!.parentElement!

  // Base UI Tooltip은 trigger의 mouseenter를 직접 듣는다.
  await act(async () => {
    icon.dispatchEvent(new MouseEvent('mouseenter'))
  })

  await vi.waitFor(() => {
    expect(document.body.textContent).toContain('레벨제한 115')
  })
  expect(requestedItemIds).toEqual([titleItem!.item.itemId])
  expect(control('칭호 교체').getAttribute('aria-expanded')).toBe('true')
})

it('목록 항목의 아이콘을 눌러도 터치로 탭해도 그 항목을 고른다', async () => {
  const [, secondTitle, thirdTitle] = slotItemsOf('title')
  await render(characterDetailFixture('dealer'))
  server.use(itemDetailHandlers.detail)
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  await act(async () => control('칭호 교체').click())
  await act(async () => option(secondTitle!.name).querySelector('img')!.click())

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], title: secondTitle!.id }))
  expect(control('칭호 교체').textContent).toBe(secondTitle!.name)

  await act(async () => control('칭호 교체').click())
  const icon = option(thirdTitle!.name).querySelector('img')!
  const touch = new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    pointerType: 'touch'
  })
  await act(async () => {
    icon.dispatchEvent(touch)
    icon.click()
  })

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], title: thirdTitle!.id }))
  expect(control('칭호 교체').textContent).toBe(thirdTitle!.name)
})

it('칭호를 고르면 빈 equipment와 고른 칭호 id를 요청하고 점수를 새 결과로 바꾼다', async () => {
  const [titleItem] = slotItemsOf('title')
  await render(characterDetailFixture('dealer'))
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  await pick('칭호 교체', titleItem!.name)

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,001,000'],
    ['차이', '+1,000']
  ])
  expect(bodies.at(-1)).toEqual({ equipment: [], title: titleItem!.id })
  expect(control('칭호 교체').textContent).toBe(titleItem!.name)
  const titleIcons = iconsIn(control('칭호 교체'))
  expect(titleIcons).toEqual([iconUrl(titleItem!.item.itemId)])
  expect(resetButton().disabled).toBe(false)
})

it('장비 수치와 크리쳐, 오라를 함께 바꾸면 한 요청에 모두 넣고, 초기화하면 모두 되돌린다', async () => {
  const [creatureItem] = slotItemsOf('creature')
  const [auraItem] = slotItemsOf('aura')
  await render(characterDetailFixture('dealer'))
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  await step('무기 수치 올리기', 1)
  await pick('크리쳐 교체', creatureItem!.name)
  await pick('오라 교체', auraItem!.name)

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,002,011'],
    ['차이', '+2,011']
  ])
  expect(bodies.at(-1)).toEqual({
    equipment: [{ slotId: 'WEAPON', reinforce: 11, amplified: false, enchantId: null }],
    creature: creatureItem!.id,
    aura: auraItem!.id
  })

  await act(async () => resetButton().click())

  expect(control('크리쳐 교체').textContent).toBe('운명을 담는 재단사')
  expect(control('오라 교체').textContent).toBe('고결한 영혼의 잔상')
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])
})

it('칭호, 크리쳐, 오라를 착용하지 않았으면 그 행을 두지 않는다', async () => {
  const detail = characterDetailFixture('dealer')
  await render({
    ...detail,
    equipment: {
      ...detail.equipment,
      equipment: detail.equipment.equipment.filter(({ slotId }) => slotId !== 'TITLE')
    },
    creature: null,
    avatar: detail.avatar.filter(({ slotId }) => slotId !== 'AURORA')
  })
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  expect(slotNames()).not.toContain('칭호')
  expect(container.querySelector('[aria-label="칭호 교체"]')).toBeNull()
  expect(container.querySelector('[aria-label="크리쳐 교체"]')).toBeNull()
  expect(container.querySelector('[aria-label="오라 교체"]')).toBeNull()
})

it('115레벨이 아닌 장비는 수치와 증폭을 막고 마법부여만 고르게 둔다', async () => {
  const detail = characterDetailFixture('dealer')
  const equipment = detail.equipment.equipment.map((item) =>
    item.slotId === 'AMULET' ? { ...item, itemAvailableLevel: 110 } : item
  )
  await render({ ...detail, equipment: { ...detail.equipment, equipment } })
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  expect(control('목걸이 수치').hasAttribute('disabled')).toBe(true)
  expect(control('목걸이 수치 내리기').hasAttribute('disabled')).toBe(true)
  expect(control('목걸이 수치 올리기').hasAttribute('disabled')).toBe(true)
  expect(control('목걸이 증폭').getAttribute('aria-disabled')).toBe('true')
  expect(control('목걸이 마법부여').hasAttribute('disabled')).toBe(false)
  expect(control('무기 수치').hasAttribute('disabled')).toBe(false)
})

it('캐릭터를 받지 못하면 오류 문구를 보이고 계산을 요청하지 않는다', async () => {
  const detail = characterDetailFixture('dealer')
  await render(detail, scoresFor, () =>
    apiFailure(404, 'CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
  )

  await expect
    .poll(() => container.querySelector('[role="alert"]')?.textContent)
    .toBe('캐릭터를 찾을 수 없습니다.')
  expect(bodies).toEqual([])
})

it('캐릭터를 받는 동안에는 받는 중 문구만 보인다', async () => {
  await render(characterDetailFixture('dealer'), scoresFor, loadingResponse)

  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    '캐릭터 정보를 받는 중입니다.'
  )
  expect(container.querySelector('table')).toBeNull()
})
