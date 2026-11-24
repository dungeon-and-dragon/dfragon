// @vitest-environment jsdom
import { enchantOptionsOf } from '@dfragon/lib/enchant-grades'
import {
  type EquipmentVariantSlot,
  equipmentSets,
  equipmentVariantsOf,
  oathCrystalVariantsOf,
  type OathUpgradeKind,
  oathUpgradeSteps,
  oathVariantOf,
  oathVariantsOf
} from '@dfragon/lib/equipment-variants'
import { slotItemsOf } from '@dfragon/lib/slot-items'
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterCardScore, CharacterDetailView } from '#entities/character'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import {
  apiFailure,
  characterUrl,
  loadingResponse
} from '#entities/character-detail/api/character-detail.handlers'
import { MISSING_VALUE } from '#shared/lib/missing-value'
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
  server.use(oathCatalogHandlers.notUploaded)
  bodies = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function identityOf({ character }: CharacterDetailView) {
  return { serverId: character.serverId, characterId: character.characterId }
}

function score(value: number, calculator: CharacterCardScore['calculator'] = 'equipment') {
  return simulationScore(calculator, { value })
}

const SLOT_ITEM_POINTS = 1_000
const TUNE_POINTS = 10_000
const VARIANT_POINTS = 100_000
const POTENCY_POINTS = 1_000_000
const KEPT_ITEM = { variantId: null, tune: null, potency: null }

// 바꾼 부위의 강화 수치 합, 고른 칭호, 크리쳐, 오라, 장비 세트, 서약 세트, 서약 본체마다 1,000점, 요청한 조율 단계마다
// 10,000점, 바꾼 아이템과 결정마다 100,000점, 정밀도마다 1,000,000점을 더해, 어떤 요청에 대한 응답인지 화면 숫자로 구분한다.
function scoresFor({ equipment, oath = [], ...chosen }: SimulationBody): Response {
  const equipmentPoints = equipment.reduce(
    (sum, { reinforce, variantId, tune, potency }) =>
      sum +
      reinforce +
      (variantId !== null ? VARIANT_POINTS : 0) +
      (tune ?? 0) * TUNE_POINTS +
      (potency ?? 0) * POTENCY_POINTS,
    0
  )
  const oathPoints = oath.reduce(
    (sum, { tune, variantId }) =>
      sum + (tune ?? 0) * TUNE_POINTS + (variantId !== null ? VARIANT_POINTS : 0),
    0
  )
  const added = equipmentPoints + oathPoints + Object.keys(chosen).length * SLOT_ITEM_POINTS

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

// 조작 패널(aside)도 "장비 세트"처럼 고른 줄의 이름을 가지므로 패널을 뺀 컨트롤에서 찾는다.
function control(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`:not(aside)[aria-label="${label}"]`)
  expect(found, label).not.toBeNull()

  return found!
}

function rowOf(slotName: string): HTMLTableRowElement {
  const rows = [
    ...container.querySelector('table')!.querySelectorAll<HTMLTableRowElement>('tbody tr')
  ]
  const found = rows.find((row) => row.querySelector('td')?.textContent === slotName)
  expect(found, slotName).toBeDefined()

  return found!
}

async function choose(slotName: string): Promise<void> {
  await act(async () => rowOf(slotName).querySelector('button')!.click())
}

// 서약 구획 줄의 첫 칸은 "세트", "서약", "결정 1"처럼 줄 이름이다.
function oathRowOf(label: string): HTMLTableRowElement {
  const rows = [...oathSection()!.querySelectorAll<HTMLTableRowElement>('tbody tr')]
  const found = rows.find((row) => row.querySelector('td')?.textContent === label)
  expect(found, label).toBeDefined()

  return found!
}

async function chooseOath(label: string): Promise<void> {
  await act(async () => oathRowOf(label).querySelector('button')!.click())
}

async function chooseCrystal(slotNo: number): Promise<void> {
  await chooseOath(`결정 ${slotNo + 1}`)
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
  expect(control('무기 마법부여').textContent).toBe('화속성 강화 +15, 명속성 강화 +15')

  await choose('상의')

  expect(control('상의 수치 내리기').hasAttribute('disabled')).toBe(true)
  expect(control('상의 수치 올리기').hasAttribute('disabled')).toBe(false)

  await choose('귀걸이')

  expect(reinforceOf('귀걸이')).toBe('+8')
  expect(control('귀걸이 증폭').getAttribute('aria-checked')).toBe('true')

  await choose('칭호')

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
  await choose('목걸이')
  await pick('목걸이 마법부여', '최종 데미지 증가 +2%')

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,012'],
    ['차이', '+12']
  ])
  expect(bodies.at(-1)).toEqual({
    equipment: [
      { ...KEPT_ITEM, slotId: 'WEAPON', reinforce: 12, amplified: true, enchantId: null },
      {
        ...KEPT_ITEM,
        slotId: 'AMULET',
        reinforce: 0,
        amplified: false,
        enchantId: amuletOption!.id
      }
    ]
  })
  await choose('무기')

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

function equipmentTable(): HTMLTableElement {
  return container.querySelector('table')!
}

function slotNames(): string[] {
  return [...equipmentTable().querySelectorAll('tbody tr')].map(
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
  expect(names.slice(0, 4)).toEqual(['세트', '무기', '칭호', '상의'])
  expect(names.slice(-4)).toEqual(['크리쳐', '오라', '아바타', '스위칭'])
  const titleRow = rowOf('칭호')
  const worn = characterDetailFixture('dealer').equipment.equipment[1]!
  expect(titleRow.querySelectorAll('td')[1]!.textContent).toBe('프로스트의 전설 플래티넘[35Lv]')
  expect([...titleRow.querySelectorAll('td')].slice(2).map((cell) => cell.textContent)).toEqual([
    '',
    ''
  ])

  await choose('칭호')

  const titleControl = control('칭호 교체')
  expect(titleControl.textContent).toBe('프로스트의 전설 플래티넘[35Lv]')
  expect(iconsIn(titleControl)).toEqual([iconUrl(worn.itemId)])

  await choose('크리쳐')

  expect(control('크리쳐 교체').textContent).toBe('운명을 담는 재단사')

  await choose('오라')

  expect(control('오라 교체').textContent).toBe('고결한 영혼의 잔상')

  await choose('칭호')
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
  await choose('칭호')
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

  await choose('칭호')
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
  // 최상위 칭호 둘은 착용한 "프로스트의 전설 플래티넘[35Lv]"과 이름 앞부분이 같아 이름으로 고를 수 없다.
  const titleItem = slotItemsOf('title').find(({ name }) => name === '진정한 각성을 이룬 자')
  await render(characterDetailFixture('dealer'))
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  await choose('칭호')
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
  // 최상위 크리쳐 둘은 착용한 "운명을 담는 재단사"와 이름 앞부분이 같아 이름으로 고를 수 없다.
  const creatureItem = slotItemsOf('creature').find(
    ({ name }) => name === 'SD 흰 구름 전령 에를리히'
  )
  const [auraItem] = slotItemsOf('aura')
  await render(characterDetailFixture('dealer'))
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  await step('무기 수치 올리기', 1)
  await choose('크리쳐')
  await pick('크리쳐 교체', creatureItem!.name)
  await choose('오라')
  await pick('오라 교체', auraItem!.name)

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,002,011'],
    ['차이', '+2,011']
  ])
  expect(bodies.at(-1)).toEqual({
    equipment: [
      { ...KEPT_ITEM, slotId: 'WEAPON', reinforce: 11, amplified: false, enchantId: null }
    ],
    creature: creatureItem!.id,
    aura: auraItem!.id
  })

  await act(async () => resetButton().click())

  expect(rowOf('크리쳐').querySelectorAll('td')[1]!.textContent).toBe('운명을 담는 재단사')
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

  expect(control('무기 수치').hasAttribute('disabled')).toBe(false)

  await choose('목걸이')

  expect(control('목걸이 수치').hasAttribute('disabled')).toBe(true)
  expect(control('목걸이 수치 내리기').hasAttribute('disabled')).toBe(true)
  expect(control('목걸이 수치 올리기').hasAttribute('disabled')).toBe(true)
  expect(control('목걸이 증폭').getAttribute('aria-disabled')).toBe('true')
  expect(control('목걸이 마법부여').hasAttribute('disabled')).toBe(false)
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

// 딜러 fixture는 소울 페어리 세트의 5축성 공용 이름 아이템을, 버퍼 fixture는 세트 밖 고유 팔찌를 낀다.
const SOUL_FAIRY_SET = '4ee7bd5912cda6e2a24c1f36d5202b46'
const ETHEREAL_SET = '93e7825053bdec4e0f4c12837cf4f57e'
const UNCHANGED_SCORES = [
  ['현재', '1,000,000'],
  ['변경 후', '1,000,000'],
  ['차이', '0']
]

function variantOf(setItemId: string, slotId: EquipmentVariantSlot, rarity: string, kind: string) {
  const found = equipmentVariantsOf(setItemId, slotId).find(
    (variant) => variant.rarity === rarity && variant.kind === kind
  )
  expect(found, `${slotId} ${rarity} ${kind}`).toBeDefined()

  return found!
}

function optionNames(): string[] {
  return [...document.querySelectorAll('[role="option"]')].map((item) => item.textContent ?? '')
}

function has(label: string): boolean {
  return container.querySelector(`[aria-label="${label}"]`) !== null
}

// 서약 본체를 고르면 조작 패널의 제목도 서약이 되므로, 장비창의 구획에서 찾는다.
function oathSection(): HTMLElement | null {
  const section = [...container.querySelectorAll('section')].find(
    (candidate) => candidate.querySelector('h2')?.textContent === '서약'
  )

  if (section === undefined) {
    return null
  }

  return section
}

it('무기는 고정 표시로 두고 나머지 장비 칸은 그 세트의 등급 선택지를 연다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  expect(has('무기 교체')).toBe(false)
  expect(has('무기 조율')).toBe(false)

  await choose('상의')

  expect(control('상의 교체').textContent).toBe('긍휼 속 자비의 상의')

  await act(async () => control('상의 교체').click())

  expect(optionNames()).toEqual(
    equipmentVariantsOf(SOUL_FAIRY_SET, 'JACKET').map(({ item }) => item.itemName)
  )
  expect(document.querySelector('[role="option"][aria-selected="true"]')?.textContent).toBe(
    variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '축성').item.itemName
  )
})

it('등급을 바꾸면 요청 body에 선택지 id를 싣고 점수를 새 결과로 바꾸며, 5축성이 풀린 다른 방어구는 축성 아이템으로 보인다', async () => {
  const corroded = variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '잠식')
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('상의')
  await pick('상의 교체', corroded.item.itemName)

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,100,000'],
    ['차이', '+100,000']
  ])
  expect(bodies.at(-1)).toEqual({
    equipment: [
      {
        slotId: 'JACKET',
        reinforce: 0,
        amplified: false,
        enchantId: null,
        variantId: corroded.id,
        tune: 0,
        potency: null
      }
    ]
  })
  expect(control('상의 교체').textContent).toBe(corroded.item.itemName)
  expect(rowOf('머리어깨').querySelectorAll('td')[1]!.textContent).toBe(
    variantOf(SOUL_FAIRY_SET, 'SHOULDER', '에픽', '축성').item.itemName
  )
  expect(rowOf('목걸이').querySelectorAll('td')[1]!.textContent).toBe(
    variantOf(SOUL_FAIRY_SET, 'AMULET', '태초', '일반').item.itemName
  )
  expect(resetButton().disabled).toBe(false)
})

it('세트 밖 장비를 낀 부위는 착용 중 아이템을 첫 항목으로 두고 주 세트의 선택지를 잇는다', async () => {
  await render(characterDetailFixture('buffer'), () =>
    HttpResponse.json({ baseline: score(4_000, 'buff'), simulated: score(4_000, 'buff') })
  )
  await expect.poll(() => container.querySelector('table') !== null).toBe(true)
  await choose('팔찌')

  expect(control('팔찌 교체').textContent).toBe('고유 - 모독자의 조소 팔찌')
  expect(has('팔찌 조율')).toBe(false)

  await act(async () => control('팔찌 교체').click())

  expect(optionNames()).toEqual([
    '고유 - 모독자의 조소 팔찌',
    ...equipmentVariantsOf(ETHEREAL_SET, 'WRIST').map(({ item }) => item.itemName)
  ])
})

it('조율을 바꾸면 그 부위의 조율 단계를 요청하고, 조율할 수 없는 태초 장비에는 조율 선택이 없다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('목걸이')

  expect(has('목걸이 조율')).toBe(false)

  await choose('보조장비')

  expect(control('보조장비 조율').textContent).toBe('-')

  await act(async () => control('보조장비 조율').click())

  expect(optionNames()).toEqual(['-', 'I', 'II', 'III'])

  await act(async () => option('II').click())

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,020,000'],
    ['차이', '+20,000']
  ])
  expect(bodies.at(-1)).toEqual({
    equipment: [
      {
        slotId: 'SUPPORT',
        reinforce: 0,
        amplified: false,
        enchantId: null,
        variantId: null,
        tune: 2,
        potency: null
      }
    ]
  })
  expect(control('보조장비 조율').textContent).toBe('II')
})

it('유일 장비를 고르면 조율 대신 정밀도를 100에서 시작하고 바꾼 정밀도를 요청한다', async () => {
  const exalted = variantOf(SOUL_FAIRY_SET, 'EARRING', '태초', '유일')
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('보조장비')
  await pick('보조장비 조율', 'III')
  await choose('귀걸이')
  await pick('귀걸이 조율', 'III')
  await pick('귀걸이 교체', exalted.item.itemName)

  expect(has('귀걸이 조율')).toBe(false)
  expect((control('귀걸이 정밀도') as HTMLInputElement).value).toBe('100')
  expect(control('귀걸이 정밀도 올리기').hasAttribute('disabled')).toBe(true)

  await step('귀걸이 정밀도 내리기', 3)

  await vi.waitFor(() =>
    expect(bodies.at(-1)?.equipment).toEqual([
      {
        slotId: 'SUPPORT',
        reinforce: 0,
        amplified: false,
        enchantId: null,
        variantId: null,
        tune: 3,
        potency: null
      },
      {
        slotId: 'EARRING',
        reinforce: 8,
        amplified: true,
        enchantId: null,
        variantId: exalted.id,
        tune: 0,
        potency: 97
      }
    ])
  )
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '98,130,008'],
    ['차이', '+97,130,008']
  ])
  await choose('보조장비')

  expect(control('보조장비 조율').textContent).toBe('III')
})

it('서약 구획은 세트, 서약, 결정을 slotNo 순서로 두고, 조율을 바꾸면 바꾼 결정만 요청한다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  const rows = [...oathSection()!.querySelectorAll('tbody tr')]
  expect(rows.map((row) => row.querySelectorAll('td')[1]?.textContent)).toEqual([
    '야망의 용투 서약',
    '세계를 태우는 용투 서약',
    '9단계',
    ...Array.from({ length: 6 }, () => '용투 : 완전한 광휘 결정III'),
    '용투 : 완전한 광휘 결정I',
    '용투 : 완전한 광휘 결정',
    ...Array.from({ length: 3 }, () => '용투 : 태초의 광휘 결정')
  ])
  await chooseCrystal(6)

  expect(control('결정 7 조율').textContent).toBe('I')

  await chooseCrystal(8)

  expect(has('결정 9 조율')).toBe(false)

  await chooseCrystal(7)
  await pick('결정 8 조율', 'III')

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,030,000'],
    ['차이', '+30,000']
  ])
  expect(bodies.at(-1)).toEqual({ equipment: [], oath: [{ slotNo: 7, tune: 3, variantId: null }] })
  expect(control('결정 8 조율').textContent).toBe('III')
})

it('서약이 없는 캐릭터는 서약 구획을 그리지 않는다', async () => {
  await render({ ...characterDetailFixture('dealer'), oath: null })
  await waitForScores(UNCHANGED_SCORES)

  expect(oathSection()).toBeNull()
  expect(container.querySelector('nav')).toBeNull()
  expect(container.querySelectorAll('table')).toHaveLength(1)
})

it('초기화하면 바꾼 등급, 조율, 서약 결정 조율을 모두 착용한 값으로 되돌린다', async () => {
  const unique = variantOf(SOUL_FAIRY_SET, 'JACKET', '유니크', '일반')
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('상의')
  await pick('상의 교체', unique.item.itemName)
  await pick('상의 조율', 'II')
  await chooseCrystal(7)
  await pick('결정 8 조율', 'I')
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,130,000'],
    ['차이', '+130,000']
  ])

  await act(async () => resetButton().click())

  expect(control('결정 8 조율').textContent).toBe('-')

  await choose('상의')

  expect(control('상의 교체').textContent).toBe('긍휼 속 자비의 상의')
  expect(control('상의 조율').textContent).toBe('-')
  await waitForScores(UNCHANGED_SCORES)
  expect(resetButton().disabled).toBe(true)
})

it('좁은 화면에서는 장비창의 줄을 누르면 그 줄의 조작을 아래에서 올라오는 시트로 연다', async () => {
  vi.stubGlobal('matchMedia', (query: string) =>
    Object.assign(new EventTarget(), { matches: query === '(width < 900px)', media: query })
  )
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  expect(document.querySelector('[role="dialog"]')).toBeNull()

  await choose('상의')

  const sheet = document.querySelector<HTMLElement>('[role="dialog"]')
  expect(sheet?.querySelector('h2')?.textContent).toBe('상의')
  expect(sheet?.querySelector('[aria-label="상의 교체"]')?.textContent).toBe('긍휼 속 자비의 상의')
})

it('캐릭터 띠가 보이는 동안에는 요약 줄이 없고, 띠가 화면 밖으로 나가면 요약 줄이 나타나 서버, 캐릭터명, 점수를 담는다', async () => {
  let reportHeader: ((inView: boolean) => void) | undefined
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(notify: IntersectionObserverCallback) {
        reportHeader = (inView) =>
          notify([{ isIntersecting: inView } as IntersectionObserverEntry], this as never)
      }

      observe(): void {}

      disconnect(): void {}
    }
  )
  const detail = characterDetailFixture('dealer')
  await render(detail)
  await waitForScores(UNCHANGED_SCORES)

  expect(container.querySelectorAll('section[aria-label="장비 점수"]')).toHaveLength(1)

  await act(async () => reportHeader!(false))

  const [, inlineScore] = container.querySelectorAll('section[aria-label="장비 점수"]')
  const summary = inlineScore!.parentElement!
  expect(summary.textContent).toContain('카인')
  expect(summary.textContent).toContain(detail.character.characterName!)
  expect(
    [...inlineScore!.querySelectorAll('dl > div')].map((row) => [
      row.querySelector('dt')!.textContent,
      row.querySelector('dd')!.firstChild?.textContent
    ])
  ).toEqual(UNCHANGED_SCORES)
})

it('목차는 장비와 서약 구획으로 옮겨 가는 링크를 둔다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  const links = [...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="목차"] a')]
  const targets = links.map((link) => document.getElementById(link.hash.slice(1)))

  expect(links.map((link) => link.textContent)).toEqual(['장비', '서약'])
  expect(targets.map((target) => target?.querySelector('h2')?.textContent)).toEqual([
    '장비',
    '서약'
  ])
})

const SHADOW_SET = '3af7c961e7d8cd8b5b42c5f82af2a0ad'
const DRAGON_OATH_SET = 16204
const SHADOW_OATH_SET = 16201

it('장비 세트 줄을 고르면 주 세트가 선택된 세트 선택을 열고, 다른 세트를 고르면 세트만 요청하고 장비창을 그 세트로 보인다', async () => {
  const corroded = variantOf(SHADOW_SET, 'JACKET', '에픽', '잠식')
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  expect(rowOf('세트').querySelectorAll('td')[1]!.textContent).toBe('소울 페어리 세트')

  await choose('세트')

  expect(control('장비 세트').textContent).toBe('소울 페어리 세트')

  await act(async () => control('장비 세트').click())

  expect(optionNames()).toEqual(equipmentSets().map(({ setItemName }) => setItemName))

  await act(async () => option('그림자에 숨은 죽음 세트').click())

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,001,000'],
    ['차이', '+1,000']
  ])
  expect(bodies.at(-1)).toEqual({ equipmentSet: SHADOW_SET, equipment: [] })
  expect(rowOf('세트').querySelectorAll('td')[1]!.textContent).toBe('그림자에 숨은 죽음 세트')

  await choose('상의')
  await pick('상의 교체', corroded.item.itemName)

  await vi.waitFor(() =>
    expect(bodies.at(-1)).toEqual({
      equipmentSet: SHADOW_SET,
      equipment: [
        {
          slotId: 'JACKET',
          reinforce: 0,
          amplified: false,
          enchantId: null,
          variantId: corroded.id,
          tune: 0,
          potency: null
        }
      ]
    })
  )
  expect(rowOf('머리어깨').querySelectorAll('td')[1]!.textContent).toBe(
    variantOf(SHADOW_SET, 'SHOULDER', '에픽', '축성').item.itemName
  )
})

it('서약 세트 줄에서 다른 세트를 고르면 세트만 요청하고 서약과 광휘 결정을 그 세트의 같은 등급으로 보인다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await chooseOath('세트')

  expect(control('서약 세트').textContent).toBe('야망의 용투 서약')

  await pick('서약 세트', '어둠에 잠긴 그림자 서약')

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], oathSet: SHADOW_OATH_SET }))
  expect(oathRowOf('세트').querySelectorAll('td')[1]!.textContent).toBe('어둠에 잠긴 그림자 서약')
  expect(oathRowOf('서약').querySelectorAll('td')[1]!.textContent).toBe(
    '태초의 어둠 속 그림자 서약'
  )
  expect(oathRowOf('결정 1').querySelectorAll('td')[1]!.textContent).toBe(
    '그림자 : 완전한 광휘 결정III'
  )
})

it('서약 줄을 고르면 같은 계열 4등급의 서약 선택을 열고, 다른 등급을 고르면 그 선택지 id를 요청한다', async () => {
  const epic = oathVariantOf(DRAGON_OATH_SET, '에픽')!
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await chooseOath('서약')

  expect(control('서약 교체').textContent).toBe('세계를 태우는 용투 서약')

  await act(async () => control('서약 교체').click())

  expect(optionNames()).toEqual(oathVariantsOf(DRAGON_OATH_SET).map(({ item }) => item.itemName))

  await act(async () => option(epic.item.itemName).click())

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], oathBody: epic.id }))
  expect(oathRowOf('서약').querySelectorAll('td')[1]!.textContent).toBe(epic.item.itemName)
})

it('결정 줄에서 등급을 바꾸면 조율을 새 결정에 맞게 자르고 그 결정의 선택지 id를 요청한다', async () => {
  const crystals = oathCrystalVariantsOf(DRAGON_OATH_SET)
  const primeval = crystals.find(({ rarity }) => rarity === '태초')!
  const epic = crystals.find(({ rarity }) => rarity === '에픽')!
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  // 태초 결정은 3개까지라 이미 3개인 딜러는 하나를 내려야 다른 결정을 태초로 올릴 수 있다.
  await chooseCrystal(8)
  await pick('결정 9 교체', epic.item.itemName)
  await chooseCrystal(6)

  expect(control('결정 7 교체').textContent).toBe('용투 : 완전한 광휘 결정')
  expect(control('결정 7 조율').textContent).toBe('I')

  await pick('결정 7 교체', primeval.item.itemName)

  await vi.waitFor(() =>
    expect(bodies.at(-1)).toEqual({
      equipment: [],
      oath: [
        { slotNo: 6, tune: 0, variantId: primeval.id },
        { slotNo: 8, tune: 0, variantId: epic.id }
      ]
    })
  )
  expect(has('결정 7 조율')).toBe(false)
  expect(oathRowOf('결정 7').querySelectorAll('td')[1]!.textContent).toBe(primeval.item.itemName)
})

it('조율할 수 있는 무기를 고르면 조율 선택을 열고 바꾼 조율을 요청한다', async () => {
  const detail = characterDetailFixture('dealer')
  const equipment = detail.equipment.equipment.map((item) =>
    item.slotId === 'WEAPON' ? { ...item, itemName: 'Beast-Saw' } : item
  )
  await render({ ...detail, equipment: { ...detail.equipment, equipment } })
  await waitForScores(UNCHANGED_SCORES)

  await act(async () => control('무기 조율').click())

  expect(optionNames()).toEqual(['-', 'I', 'II', 'III'])

  await act(async () => option('II').click())

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,020,010'],
    ['차이', '+20,010']
  ])
  expect(bodies.at(-1)).toEqual({
    equipment: [
      {
        slotId: 'WEAPON',
        reinforce: 10,
        amplified: false,
        enchantId: null,
        variantId: null,
        tune: 2,
        potency: null
      }
    ]
  })
})

it('서약 본체는 서약 카탈로그의 그림으로 장비창 줄, 닫힌 선택 칸, 목록 항목에 보이고 카탈로그에 없는 본체는 빈 칸이다', async () => {
  const icon = 'https://skilltab.test/oath-item/primeval.webp'
  const catalog = {
    ...oathCatalogFixture.characterDetail,
    items: [{ name: '세계를 태우는 용투 서약', rarity: '태초', icon }]
  }
  server.use(oathCatalogHandlers.catalog(catalog))
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await vi.waitFor(() => expect(iconsIn(oathRowOf('서약'))).toEqual([icon]))

  await chooseOath('서약')

  expect(iconsIn(control('서약 교체'))).toEqual([icon])

  await act(async () => control('서약 교체').click())

  const optionIcons = [...document.querySelectorAll('[role="option"]')].map(iconsIn)

  expect(optionIcons.at(-1)).toEqual([icon])
  expect(optionIcons.slice(0, -1).flat()).not.toContain(icon)
})

it('태초 결정이 이미 3개면 다른 결정의 선택 목록에 태초 결정을 두지 않는다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await chooseCrystal(0)
  await act(async () => control('결정 1 교체').click())

  expect(optionNames()).toEqual(
    oathCrystalVariantsOf(DRAGON_OATH_SET)
      .filter(({ rarity }) => rarity !== '태초')
      .map(({ item }) => item.itemName)
  )
})

function upgradeOptionOf(step: number, kind: OathUpgradeKind): string {
  return oathUpgradeSteps()[step - 1]!.options.find((option) => option.kind === kind)!.option
}

function upgradeLevelText(): string | null {
  return oathRowOf('묵언의 진의').querySelectorAll('td')[1]!.textContent
}

it('진의 줄을 고르면 단계마다 체크박스와 1~4단계 선택 칸을 두고, 쿨타임 감소를 낀 단계는 최종 데미지로 보이며 서약 포인트에서 최종 데미지로 되돌리면 착용 그대로다', async () => {
  const worn = ['고요한 호흡', '자애의 마음', '내면의 조율', '신념의 대가'].map(
    (option, index) => ({ step: index + 1, option })
  )
  const speeds = [5, 6, 7, 8, 9].map((step) => ({ step, option: upgradeOptionOf(step, 'Speed') }))
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  expect(upgradeLevelText()).toBe('9단계')

  await chooseOath('묵언의 진의')

  expect(control('첫 번째 진의').getAttribute('aria-checked')).toBe('true')
  expect(control('첫 번째 진의 선택지').textContent).toBe('최종 데미지')
  expect(container.querySelector('[aria-label="다섯 번째 진의 선택지"]')).toBeNull()

  await pick('두 번째 진의 선택지', '서약 포인트')

  await vi.waitFor(() =>
    expect(bodies.at(-1)).toEqual({
      equipment: [],
      oathUpgrade: [
        worn[0],
        { step: 2, option: upgradeOptionOf(2, 'Oathpoint') },
        ...worn.slice(2),
        ...speeds
      ]
    })
  )
  expect(control('두 번째 진의 선택지').textContent).toBe('서약 포인트')

  await pick('두 번째 진의 선택지', '최종 데미지')

  expect(control('두 번째 진의 선택지').textContent).toBe('최종 데미지')
  expect(upgradeLevelText()).toBe('9단계')
  expect(resetButton().disabled).toBe(true)
})

it('진의 체크를 풀면 그 뒤 단계도 내리고, 건너뛰어 체크하면 사이 단계를 기본 선택지로 채워 바꾼 진의 전체를 요청한다', async () => {
  const worn = ['고요한 호흡', '자애의 마음', '내면의 조율', '신념의 대가', '이어진 걸음'].map(
    (option, index) => ({ step: index + 1, option })
  )
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)
  await chooseOath('묵언의 진의')

  await act(async () => control('여섯 번째 진의').click())

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], oathUpgrade: worn }))
  expect(upgradeLevelText()).toBe('5단계')
  expect(control('여섯 번째 진의').getAttribute('aria-checked')).toBe('false')
  expect(control('아홉 번째 진의').getAttribute('aria-checked')).toBe('false')

  await act(async () => control('첫 번째 진의').click())

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], oathUpgrade: [] }))
  expect(upgradeLevelText()).toBe(MISSING_VALUE)
  expect(container.querySelector('[aria-label="첫 번째 진의 선택지"]')).toBeNull()

  await act(async () => control('세 번째 진의').click())

  await vi.waitFor(() =>
    expect(bodies.at(-1)).toEqual({
      equipment: [],
      oathUpgrade: [1, 2, 3].map((step) => ({ step, option: upgradeOptionOf(step, 'Damage') }))
    })
  )
  expect(upgradeLevelText()).toBe('3단계')
  expect(control('두 번째 진의').getAttribute('aria-checked')).toBe('true')
  expect(control('두 번째 진의 선택지').textContent).toBe('최종 데미지')
})

function rowValueOf(slotName: string): string | null {
  return rowOf(slotName).querySelectorAll('td')[1]!.textContent
}

// scoresFor는 고른 아바타 프리셋과 스위칭 레벨도 칭호처럼 1,000점으로 센다.
const ONE_CHOICE_SCORES = [
  ['현재', '1,000,000'],
  ['변경 후', '1,001,000'],
  ['차이', '+1,000']
]

function editorTitle(): string | null | undefined {
  return container.querySelector('aside h2')?.textContent
}

it('아바타 줄은 지금 그대로를, 스위칭 줄은 버프 강화 스킬 이름과 지금 레벨을 보인다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  expect(rowValueOf('아바타')).toBe('지금 그대로')
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨')
})

it('버퍼는 주 버프 스킬의 지금 레벨을 스위칭 줄에 보인다', async () => {
  await render(characterDetailFixture('buffer'))

  await vi.waitFor(() => expect(rowValueOf('스위칭')).toBe('러블리 템포 30레벨'))
})

it('끝 스펙 프리셋이 없는 전직에는 아바타 줄만 없다', async () => {
  const detail = characterDetailFixture('dealer')
  await render({ ...detail, character: { ...detail.character, jobGrowId: 'unknown-job-grow' } })
  await waitForScores(UNCHANGED_SCORES)

  expect(slotNames()).not.toContain('아바타')
  expect(slotNames()).toContain('스위칭')
})

it('버프 강화 스킬을 바꿀 수 없는 캐릭터에는 스위칭 줄만 없다', async () => {
  const detail = characterDetailFixture('dealer')
  await render({ ...detail, buff: { ...detail.buff, equipment: null } })
  await waitForScores(UNCHANGED_SCORES)

  expect(slotNames()).not.toContain('스위칭')
  expect(slotNames()).toContain('아바타')
})

it('스위칭 줄을 고르면 스킬 이름 칸에 배운 레벨부터 10레벨 위까지 고르게 두고, 고른 레벨을 요청하며 지금 레벨로 돌아오면 원본 점수로 돌아간다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('스위칭')

  expect(editorTitle()).toBe('스위칭')
  expect(container.querySelector('aside .label')?.textContent).toBe('광적인 믿음')
  expect(control('스위칭 레벨').textContent).toBe('16레벨')

  await act(async () => control('스위칭 레벨').click())

  expect(optionNames()).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => `${n}레벨`))

  await act(async () =>
    [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(({ textContent }) => textContent === '20레벨')!
      .click()
  )

  await waitForScores(ONE_CHOICE_SCORES)
  expect(bodies.at(-1)).toEqual({ equipment: [], buffLevel: 20 })
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 20레벨')
  expect(resetButton().disabled).toBe(false)

  await pick('스위칭 레벨', '16레벨')

  await waitForScores(UNCHANGED_SCORES)
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨')
  expect(resetButton().disabled).toBe(true)
})

it('아바타 줄에서 끝 스펙을 고르면 프리셋을 요청하고, 지금 그대로로 돌아오면 원본 점수로 돌아간다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('아바타')

  expect(editorTitle()).toBe('아바타')
  expect(control('아바타').textContent).toBe('지금 그대로')

  await pick('아바타', '끝 스펙')

  await waitForScores(ONE_CHOICE_SCORES)
  expect(bodies.at(-1)).toEqual({ equipment: [], avatarPreset: 'best' })
  expect(rowValueOf('아바타')).toBe('끝 스펙')

  await pick('아바타', '지금 그대로')

  await waitForScores(UNCHANGED_SCORES)
  expect(rowValueOf('아바타')).toBe('지금 그대로')
  expect(resetButton().disabled).toBe(true)
})

it('초기화하면 고른 아바타 프리셋과 스위칭 레벨을 함께 되돌린다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)
  await choose('아바타')
  await pick('아바타', '끝 스펙')
  await choose('스위칭')
  await pick('스위칭 레벨', '12레벨')
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,002,000'],
    ['차이', '+2,000']
  ])
  expect(bodies.at(-1)).toEqual({ equipment: [], avatarPreset: 'best', buffLevel: 12 })

  await act(async () => resetButton().click())

  await waitForScores(UNCHANGED_SCORES)
  expect(rowValueOf('아바타')).toBe('지금 그대로')
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨')
  expect(control('스위칭 레벨').textContent).toBe('16레벨')
})
