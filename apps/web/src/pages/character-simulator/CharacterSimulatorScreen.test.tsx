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
import {
  type CharacterCardScore,
  type CharacterDetailView,
  rarityTextClasses
} from '#entities/character'
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
import { simulationScore, withSwitchingEquipment } from './api/simulation.fixture'
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
const RELEASE_POINTS = 10_000_000
const KEPT_ITEM = { variantId: null, tune: null, potency: null, release: null }

// 바꾼 부위의 강화 수치 합, 고른 칭호, 크리쳐, 오라, 장비 세트, 서약 세트, 서약 본체마다 1,000점, 요청한 조율 단계마다
// 10,000점, 바꾼 아이템과 결정마다 100,000점, 정밀도마다 1,000,000점, 해방 수치마다 10,000,000점을 더해, 어떤 요청에 대한
// 응답인지 화면 숫자로 구분한다.
function scoresFor({ equipment, oath = [], ...chosen }: SimulationBody): Response {
  const equipmentPoints = equipment.reduce(
    (sum, { reinforce, variantId, tune, potency, release }) =>
      sum +
      reinforce +
      (variantId !== null ? VARIANT_POINTS : 0) +
      (tune ?? 0) * TUNE_POINTS +
      (potency ?? 0) * POTENCY_POINTS +
      (release ?? 0) * RELEASE_POINTS,
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

// 서약 본체를 고르면 조작 패널의 제목도 서약이 되므로, 장비창의 구획은 구획 제목으로 찾는다.
function windowSection(title: string): HTMLElement | null {
  const section = [...container.querySelectorAll('section')].find(
    (candidate) => candidate.querySelector('h2')?.textContent === title
  )

  if (section === undefined) {
    return null
  }

  return section
}

// aria-labelledby로 이어 둔 제목을 읽어, 제목과 이어지지 않은 구획은 빠진다.
function windowSectionTitles(): (string | null | undefined)[] {
  return [...container.querySelectorAll('section[aria-labelledby]')].map(
    (section) => document.getElementById(section.getAttribute('aria-labelledby')!)?.textContent
  )
}

function rowsIn(title: string): HTMLTableRowElement[] {
  return [...(windowSection(title)?.querySelectorAll<HTMLTableRowElement>('tbody tr') ?? [])]
}

// 장비 구획과 기타 구획의 줄 이름은 서로 겹치지 않는다. 서약 구획의 "세트"는 oathRowOf로 찾는다.
function rowOf(slotName: string): HTMLTableRowElement {
  const rows = ['장비', '기타'].flatMap(rowsIn)
  const found = rows.find((row) => row.querySelector('td')?.textContent === slotName)
  expect(found, slotName).toBeDefined()

  return found!
}

async function choose(slotName: string): Promise<void> {
  await act(async () => rowOf(slotName).querySelector('button')!.click())
}

// 서약 구획 줄의 첫 칸은 "세트", "서약", "결정 1"처럼 줄 이름이다.
function oathRowOf(label: string): HTMLTableRowElement {
  const rows = rowsIn('서약')
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

function buttonsIn(label: string): HTMLButtonElement[] {
  return [...control(label).querySelectorAll<HTMLButtonElement>('button')]
}

function buttonNames(label: string): string[] {
  return buttonsIn(label).map((button) => button.textContent ?? '')
}

function buttonOf(label: string, name: string): HTMLButtonElement {
  const found = buttonsIn(label).find((button) => button.textContent === name)
  expect(found, name).toBeDefined()

  return found!
}

function pressedButton(label: string): HTMLButtonElement | null {
  return control(label).querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
}

function pressedIn(label: string): string | null {
  const pressed = pressedButton(label)

  if (pressed === null) {
    return null
  }

  return pressed.textContent
}

async function press(label: string, name: string): Promise<void> {
  const button = buttonsIn(label).find((candidate) => candidate.textContent?.startsWith(name))
  expect(button, name).toBeDefined()
  await act(async () => button!.click())
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
  expect(pressedIn('무기 마법부여')).toBe('현재 마법부여화속성 강화 +15, 명속성 강화 +15')

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
  await press('목걸이 마법부여', '최종 데미지 증가 +2%')

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

it('엔진이 지원하지 않는 변경은 바꾼 뒤 점수와 차이를 비우고 이유를 마우스 설명으로 전한다', async () => {
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
  expect(scoreValue('변경 후').getAttribute('title')).toBe(
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

function etcNames(): string[] {
  return rowsIn('기타').map((row) => row.querySelector('td')?.textContent ?? '')
}

function iconsIn(element: Element): (string | null)[] {
  return [...element.querySelectorAll('img')].map((image) => image.getAttribute('src'))
}

function iconUrl(itemId: string | null): string {
  return `https://img-api.neople.co.kr/df/items/${itemId}`
}

it('칭호는 무기 다음 자리에, 크리쳐와 오라는 장비 뒤에 두고 장비 칸의 켜진 버튼에 착용한 아이템의 아이콘과 이름을 보인다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  const names = slotNames()
  expect(names.slice(0, 4)).toEqual(['세트', '무기', '칭호', '상의'])
  expect(names.slice(-2)).toEqual(['크리쳐', '오라'])
  const titleRow = rowOf('칭호')
  const worn = characterDetailFixture('dealer').equipment.equipment[1]!
  expect(titleRow.querySelectorAll('td')[1]!.textContent).toBe('프로스트의 전설 플래티넘[35Lv]')
  expect([...titleRow.querySelectorAll('td')].slice(2).map((cell) => cell.textContent)).toEqual([
    '',
    ''
  ])

  await choose('칭호')

  expect(pressedIn('칭호 교체')).toBe('프로스트의 전설 플래티넘[35Lv]')
  expect(iconsIn(pressedButton('칭호 교체')!)).toEqual([iconUrl(worn.itemId)])

  await choose('크리쳐')

  expect(pressedIn('크리쳐 교체')).toBe('운명을 담는 재단사')

  await choose('오라')

  expect(pressedIn('오라 교체')).toBe('고결한 영혼의 잔상')

  await choose('칭호')
  expect(buttonNames('칭호 교체')).toEqual([
    '프로스트의 전설 플래티넘[35Lv]',
    ...slotItemsOf('title').map(({ name }) => name)
  ])
  expect(buttonsIn('칭호 교체').map((button) => iconsIn(button))).toEqual([
    [iconUrl(worn.itemId)],
    ...slotItemsOf('title').map(({ item }) => [iconUrl(item.itemId)])
  ])
})

it('선택 버튼의 아이콘에 마우스를 올리면 그 아이템의 정보를 tooltip으로 보이고 고르지는 않는다', async () => {
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
  const icon = buttonOf('칭호 교체', titleItem!.name).querySelector('img')!.parentElement!

  // Base UI Tooltip은 trigger의 mouseenter를 직접 듣는다.
  await act(async () => {
    icon.dispatchEvent(new MouseEvent('mouseenter'))
  })

  await vi.waitFor(() => {
    expect(document.body.textContent).toContain('레벨제한 115')
  })
  expect(requestedItemIds).toEqual([titleItem!.item.itemId])
  expect(pressedIn('칭호 교체')).toBe('프로스트의 전설 플래티넘[35Lv]')
})

it('선택 버튼의 아이콘을 눌러도 터치로 탭해도 그 버튼을 고른다', async () => {
  const [, secondTitle, thirdTitle] = slotItemsOf('title')
  await render(characterDetailFixture('dealer'))
  server.use(itemDetailHandlers.detail)
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,000,000'],
    ['차이', '0']
  ])

  await choose('칭호')
  await act(async () => buttonOf('칭호 교체', secondTitle!.name).querySelector('img')!.click())

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], title: secondTitle!.id }))
  expect(pressedIn('칭호 교체')).toBe(secondTitle!.name)

  const icon = buttonOf('칭호 교체', thirdTitle!.name).querySelector('img')!
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
  expect(pressedIn('칭호 교체')).toBe(thirdTitle!.name)
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
  await press('칭호 교체', titleItem!.name)

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,001,000'],
    ['차이', '+1,000']
  ])
  expect(bodies.at(-1)).toEqual({ equipment: [], title: titleItem!.id })
  expect(pressedIn('칭호 교체')).toBe(titleItem!.name)
  const titleIcons = iconsIn(pressedButton('칭호 교체')!)
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
  await press('크리쳐 교체', creatureItem!.name)
  await choose('오라')
  await press('오라 교체', auraItem!.name)

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
  expect(pressedIn('오라 교체')).toBe('고결한 영혼의 잔상')
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
  const enchantButtons = buttonsIn('목걸이 마법부여')

  expect(enchantButtons.length).toBeGreaterThan(1)
  expect(enchantButtons.some((button) => button.disabled)).toBe(false)
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

it('장비 칸은 그 세트의 등급 선택지를 버튼으로 나열하고 착용한 등급을 켠다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('상의')

  expect(buttonNames('상의 교체')).toEqual(
    equipmentVariantsOf(SOUL_FAIRY_SET, 'JACKET').map(({ item }) => item.itemName)
  )
  expect(pressedIn('상의 교체')).toBe(
    variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '축성').item.itemName
  )
})

// 딜러 fixture는 낫 해방 계열의 해방 수치 100 무기(재앙의 송곳니)를 낀다. 낫 선택지 순서는 엔진 무기 목록 순서다.
const SCYTHE_OPTIONS = [
  '유니크',
  '레거시',
  '태초의 별',
  '레거시',
  '태초의 별',
  '레거시',
  '레거시 조율 완료',
  '디거시',
  '태초의 별'
]
const SCYTHE_LEGACY_PRIMEVAL = '413aebce4d4cc7c7346aa6e32e27a6dd'
const WEAPON_CHANGE = { slotId: 'WEAPON', reinforce: 10, amplified: false, enchantId: null }

function weaponCell(): string | null {
  return rowOf('무기').querySelectorAll('td')[1]!.textContent
}

it('무기는 착용한 무기 종류의 선택지를 계열 이름으로 나열하고, 해방 계열을 낀 무기는 해방 수치를 보인다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)
  await choose('무기')

  expect(pressedIn('무기 교체')).toBe('디거시')
  expect((control('무기 해방') as HTMLInputElement).value).toBe('100')
  expect(has('무기 조율')).toBe(false)
  expect(weaponCell()).toBe('디거시')
  expect(buttonNames('무기 교체')).toEqual(SCYTHE_OPTIONS)
})

it('해방 수치를 낮추면 수치만 요청한다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)
  await choose('무기')

  await step('무기 해방 내리기', 19)

  await vi.waitFor(() =>
    expect(bodies.at(-1)?.equipment).toEqual([{ ...WEAPON_CHANGE, ...KEPT_ITEM, release: 81 }])
  )
})

it('디거시에서 레거시로 바꾸면 해방 수치를 감추고 조율 버튼을 두며 바꾼 무기를 요청한다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)
  await choose('무기')

  const legacy = buttonsIn('무기 교체')[5]!
  await act(async () => legacy.click())

  await vi.waitFor(() =>
    expect(bodies.at(-1)?.equipment).toEqual([
      { ...WEAPON_CHANGE, ...KEPT_ITEM, variantId: SCYTHE_LEGACY_PRIMEVAL, tune: 0 }
    ])
  )
  expect(pressedIn('무기 교체')).toBe('레거시')
  expect(has('무기 해방')).toBe(false)
  expect(has('무기 조율')).toBe(true)
  expect(weaponCell()).toBe('레거시')
})

it('등급을 바꾸면 요청 body에 선택지 id를 싣고 점수를 새 결과로 바꾸며, 5축성이 풀린 다른 방어구는 축성 아이템으로 보인다', async () => {
  const corroded = variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '잠식')
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('상의')
  await press('상의 교체', corroded.item.itemName)

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
        potency: null,
        release: null
      }
    ]
  })
  expect(pressedIn('상의 교체')).toBe(corroded.item.itemName)
  expect(rowOf('머리어깨').querySelectorAll('td')[1]!.textContent).toBe(
    variantOf(SOUL_FAIRY_SET, 'SHOULDER', '에픽', '축성').item.itemName
  )
  expect(rowOf('목걸이').querySelectorAll('td')[1]!.textContent).toBe(
    variantOf(SOUL_FAIRY_SET, 'AMULET', '태초', '일반').item.itemName
  )
  expect(resetButton().disabled).toBe(false)
})

it('세트 밖 장비를 낀 부위는 착용 중 아이템을 첫 버튼으로 두고 주 세트의 선택지를 잇는다', async () => {
  await render(characterDetailFixture('buffer'), () =>
    HttpResponse.json({ baseline: score(4_000, 'buff'), simulated: score(4_000, 'buff') })
  )
  await expect.poll(() => container.querySelector('table') !== null).toBe(true)
  await choose('팔찌')

  expect(pressedIn('팔찌 교체')).toBe('고유 - 모독자의 조소 팔찌')
  expect(has('팔찌 조율')).toBe(false)
  expect(buttonNames('팔찌 교체')).toEqual([
    '고유 - 모독자의 조소 팔찌',
    ...equipmentVariantsOf(ETHEREAL_SET, 'WRIST').map(({ item }) => item.itemName)
  ])
})

it('조율 버튼을 누르면 그 부위의 조율 단계를 요청하고 켜진 버튼을 다시 누르면 조율을 풀며, 조율할 수 없는 태초 장비에는 조율 버튼이 없다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('목걸이')

  expect(has('목걸이 조율')).toBe(false)

  await choose('보조장비')

  expect(pressedIn('보조장비 조율')).toBeNull()
  expect(buttonNames('보조장비 조율')).toEqual(['I', 'II', 'III'])

  await press('보조장비 조율', 'II')

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
        potency: null,
        release: null
      }
    ]
  })
  expect(pressedIn('보조장비 조율')).toBe('II')

  await press('보조장비 조율', 'II')

  await waitForScores(UNCHANGED_SCORES)
  expect(pressedIn('보조장비 조율')).toBeNull()
  expect(resetButton().disabled).toBe(true)
})

it('유일 장비를 고르면 조율 대신 정밀도를 100에서 시작하고 바꾼 정밀도를 요청한다', async () => {
  const exalted = variantOf(SOUL_FAIRY_SET, 'EARRING', '태초', '유일')
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('보조장비')
  await press('보조장비 조율', 'III')
  await choose('귀걸이')
  await press('귀걸이 조율', 'III')
  await press('귀걸이 교체', exalted.item.itemName)

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
        potency: null,
        release: null
      },
      {
        slotId: 'EARRING',
        reinforce: 8,
        amplified: true,
        enchantId: null,
        variantId: exalted.id,
        tune: 0,
        potency: 97,
        release: null
      }
    ])
  )
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '98,130,008'],
    ['차이', '+97,130,008']
  ])
  await choose('보조장비')

  expect(pressedIn('보조장비 조율')).toBe('III')
})

it('서약 구획은 세트, 서약, 결정을 slotNo 순서로 두고, 조율을 바꾸면 바꾼 결정만 요청한다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  const rows = rowsIn('서약')
  expect(rows.map((row) => row.querySelectorAll('td')[1]?.textContent)).toEqual([
    '야망의 용투 서약',
    '세계를 태우는 용투 서약',
    ...Array.from({ length: 6 }, () => '용투 : 완전한 광휘 결정III'),
    '용투 : 완전한 광휘 결정I',
    '용투 : 완전한 광휘 결정',
    ...Array.from({ length: 3 }, () => '용투 : 태초의 광휘 결정')
  ])
  await chooseCrystal(6)

  expect(pressedIn('결정 7 조율')).toBe('I')

  await chooseCrystal(8)

  expect(has('결정 9 조율')).toBe(false)

  await chooseCrystal(7)
  await press('결정 8 조율', 'III')

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,030,000'],
    ['차이', '+30,000']
  ])
  expect(bodies.at(-1)).toEqual({ equipment: [], oath: [{ slotNo: 7, tune: 3, variantId: null }] })
  expect(pressedIn('결정 8 조율')).toBe('III')
})

it('장비창은 장비, 서약, 기타 구획 순서이고 기타 구획에 아바타, 스위칭, 묵언의 진의를 둔다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  expect(windowSectionTitles()).toEqual(['장비', '서약', '기타'])
  expect(etcNames()).toEqual(['아바타', '스위칭', '묵언의 진의'])
})

it('서약이 없는 캐릭터는 서약 구획과 묵언의 진의 줄 없이 장비, 기타 구획만 그린다', async () => {
  await render({ ...characterDetailFixture('dealer'), oath: null })
  await waitForScores(UNCHANGED_SCORES)

  expect(windowSectionTitles()).toEqual(['장비', '기타'])
  expect(etcNames()).toEqual(['아바타', '스위칭'])
})

it('아바타, 스위칭, 묵언의 진의 줄이 모두 없으면 기타 구획을 그리지 않는다', async () => {
  const detail = characterDetailFixture('dealer')
  await render({
    ...detail,
    character: { ...detail.character, jobGrowId: 'unknown-job-grow' },
    buff: { ...detail.buff, equipment: null },
    oath: null
  })
  await waitForScores(UNCHANGED_SCORES)

  expect(windowSectionTitles()).toEqual(['장비'])
})

it('초기화하면 바꾼 등급, 조율, 서약 결정 조율을 모두 착용한 값으로 되돌린다', async () => {
  const unique = variantOf(SOUL_FAIRY_SET, 'JACKET', '유니크', '일반')
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('상의')
  await press('상의 교체', unique.item.itemName)
  await press('상의 조율', 'II')
  await chooseCrystal(7)
  await press('결정 8 조율', 'I')
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,130,000'],
    ['차이', '+130,000']
  ])

  await act(async () => resetButton().click())

  expect(pressedIn('결정 8 조율')).toBeNull()

  await choose('상의')

  expect(pressedIn('상의 교체')).toBe(
    variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '축성').item.itemName
  )
  expect(pressedIn('상의 조율')).toBeNull()
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
  expect(sheet?.querySelector('[aria-label="상의 교체"] [aria-pressed="true"]')?.textContent).toBe(
    variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '축성').item.itemName
  )
  expect(sheet?.querySelector('[aria-label="상의 조율"]')?.querySelectorAll('button')).toHaveLength(
    3
  )
  expect(
    sheet?.querySelector('[aria-label="상의 마법부여"] [aria-pressed="true"]')?.textContent
  ).toMatch(/^현재 마법부여/)

  await choose('무기')

  const weaponSheet = document.querySelector<HTMLElement>('[role="dialog"]')
  expect(
    weaponSheet?.querySelector('[aria-label="무기 교체"] [aria-pressed="true"]')?.textContent
  ).toBe('디거시')
  expect(weaponSheet?.querySelector<HTMLInputElement>('[aria-label="무기 해방"]')?.value).toBe(
    '100'
  )

  await choose('스위칭')

  const switchingSheet = document.querySelector<HTMLElement>('[role="dialog"]')
  expect(switchingSheet?.querySelector('h2')?.textContent).toBe('스위칭')
  expect(
    switchingSheet?.querySelector<HTMLInputElement>('[aria-label="짙편린 부위 수"]')?.value
  ).toBe('0')
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

it('장비창 줄은 부위, 강화, 마법부여 칸을 눌러도 그 줄을 고른다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await act(async () => rowOf('상의').querySelectorAll('td')[0]!.click())

  expect(editorTitle()).toBe('상의')
  expect(rowOf('상의').querySelector('button')!.getAttribute('aria-pressed')).toBe('true')

  await act(async () => rowOf('목걸이').querySelectorAll('td')[2]!.click())

  expect(editorTitle()).toBe('목걸이')
  expect(rowOf('상의').getAttribute('aria-selected')).toBe('false')

  await act(async () => rowOf('무기').querySelectorAll('td')[3]!.click())

  expect(editorTitle()).toBe('무기')

  await act(async () => oathRowOf('결정 1').querySelector('td')!.click())

  expect(editorTitle()).toBe('서약 결정')
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

  expect(buttonNames('장비 세트')).toEqual(equipmentSets().map(({ setItemName }) => setItemName))
  expect(pressedIn('장비 세트')).toBe('소울 페어리 세트')

  await press('장비 세트', '그림자에 숨은 죽음 세트')

  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,001,000'],
    ['차이', '+1,000']
  ])
  expect(bodies.at(-1)).toEqual({ equipmentSet: SHADOW_SET, equipment: [] })
  expect(rowOf('세트').querySelectorAll('td')[1]!.textContent).toBe('그림자에 숨은 죽음 세트')
  expect(rowOf('세트').querySelector('b')!.className).toContain(rarityTextClasses.primordial)

  await choose('상의')
  await press('상의 교체', corroded.item.itemName)

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
          potency: null,
          release: null
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

  expect(pressedIn('서약 세트')).toBe('야망의 용투 서약')

  await press('서약 세트', '어둠에 잠긴 그림자 서약')

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], oathSet: SHADOW_OATH_SET }))
  expect(oathRowOf('세트').querySelectorAll('td')[1]!.textContent).toBe('어둠에 잠긴 그림자 서약')
  expect(oathRowOf('세트').querySelector('b')!.className).toContain(rarityTextClasses.primordial)
  expect(oathRowOf('서약').querySelectorAll('td')[1]!.textContent).toBe(
    '태초의 어둠 속 그림자 서약'
  )
  expect(oathRowOf('결정 1').querySelectorAll('td')[1]!.textContent).toBe(
    '그림자 : 완전한 광휘 결정III'
  )
})

it('장비 세트와 서약 세트 이름은 응답이 준 세트 등급의 색으로 보인다', async () => {
  const detail = characterDetailFixture('dealer')
  const setItemInfo = detail.equipment.setItemInfo.map((set) => ({
    ...set,
    setItemRarityName: '에픽'
  }))
  const oath = { ...detail.oath!, setInfo: { ...detail.oath!.setInfo!, setRarityName: '레전더리' } }
  await render({ ...detail, equipment: { ...detail.equipment, setItemInfo }, oath })
  await waitForScores(UNCHANGED_SCORES)

  expect(rowOf('세트').querySelector('b')!.className).toContain(rarityTextClasses.epic)
  expect(oathRowOf('세트').querySelector('b')!.className).toContain(rarityTextClasses.legendary)
})

it('서약 줄을 고르면 같은 계열 4등급의 서약 버튼을 두고, 다른 등급을 고르면 그 선택지 id를 요청한다', async () => {
  const epic = oathVariantOf(DRAGON_OATH_SET, '에픽')!
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await chooseOath('서약')

  expect(pressedIn('서약 교체')).toBe('세계를 태우는 용투 서약')
  expect(buttonNames('서약 교체')).toEqual(
    oathVariantsOf(DRAGON_OATH_SET).map(({ item }) => item.itemName)
  )

  await act(async () => buttonOf('서약 교체', epic.item.itemName).click())

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
  await press('결정 9 교체', epic.item.itemName)
  await chooseCrystal(6)

  expect(pressedIn('결정 7 교체')).toBe('용투 : 완전한 광휘 결정')
  expect(pressedIn('결정 7 조율')).toBe('I')

  await press('결정 7 교체', primeval.item.itemName)

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

it('선택지에 없는 조율할 수 있는 무기는 착용 아이템을 켠 첫 버튼으로 두고, 조율 버튼으로 바꾼 조율을 요청한다', async () => {
  const detail = characterDetailFixture('dealer')
  const equipment = detail.equipment.equipment.map((item) =>
    item.slotId === 'WEAPON' ? { ...item, itemId: 'unlisted-weapon', itemName: 'Beast-Saw' } : item
  )
  await render({ ...detail, equipment: { ...detail.equipment, equipment } })
  await waitForScores(UNCHANGED_SCORES)
  await choose('무기')

  expect(pressedIn('무기 교체')).toBe('Beast-Saw')
  expect(buttonNames('무기 교체')[0]).toBe('Beast-Saw')
  expect(buttonNames('무기 조율')).toEqual(['I', 'II', 'III'])

  await press('무기 조율', 'II')

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
        potency: null,
        release: null
      }
    ]
  })

  expect(pressedIn('무기 교체')).toBe('Beast-Saw')
})

it('서약 본체는 서약 카탈로그의 그림으로 장비창 줄과 선택 버튼에 보이고 카탈로그에 없는 본체는 빈 칸이다', async () => {
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

  expect(iconsIn(pressedButton('서약 교체')!)).toEqual([icon])

  const optionIcons = buttonsIn('서약 교체').map(iconsIn)

  expect(optionIcons.at(-1)).toEqual([icon])
  expect(optionIcons.slice(0, -1).flat()).not.toContain(icon)
})

it('태초 결정이 이미 3개면 다른 결정의 선택 버튼에 태초 결정을 두지 않는다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await chooseCrystal(0)

  expect(buttonNames('결정 1 교체')).toEqual(
    oathCrystalVariantsOf(DRAGON_OATH_SET)
      .filter(({ rarity }) => rarity !== '태초')
      .map(({ item }) => item.itemName)
  )
})

function upgradeOptionOf(step: number, kind: OathUpgradeKind): string {
  return oathUpgradeSteps()[step - 1]!.options.find((option) => option.kind === kind)!.option
}

const UPGRADE_STEP_NAMES = [
  '첫 번째 진의',
  '두 번째 진의',
  '세 번째 진의',
  '네 번째 진의',
  '다섯 번째 진의',
  '여섯 번째 진의',
  '일곱 번째 진의',
  '여덟 번째 진의',
  '아홉 번째 진의'
]

function upgradeLevelText(): string | null {
  return rowOf('묵언의 진의').querySelectorAll('td')[1]!.textContent
}

it('진의 줄을 고르면 아홉 단계의 체크박스만 두고 선택지 칸은 두지 않는다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  expect(upgradeLevelText()).toBe('9단계')

  await choose('묵언의 진의')

  expect(
    [...container.querySelectorAll('aside [role="checkbox"]')].map((box) => [
      box.getAttribute('aria-label'),
      box.getAttribute('aria-checked')
    ])
  ).toEqual(UPGRADE_STEP_NAMES.map((name) => [name, 'true']))
  expect(container.querySelector('[aria-label$="진의 선택지"]')).toBeNull()
})

it('진의 체크를 풀면 그 뒤 단계도 내리고, 건너뛰어 체크하면 사이 단계를 기본 선택지로 채워 바꾼 진의 전체를 요청한다', async () => {
  const worn = ['고요한 호흡', '자애의 마음', '내면의 조율', '신념의 대가', '이어진 걸음'].map(
    (option, index) => ({ step: index + 1, option })
  )
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)
  await choose('묵언의 진의')

  await act(async () => control('여섯 번째 진의').click())

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], oathUpgrade: worn }))
  expect(upgradeLevelText()).toBe('5단계')
  expect(control('여섯 번째 진의').getAttribute('aria-checked')).toBe('false')
  expect(control('아홉 번째 진의').getAttribute('aria-checked')).toBe('false')

  await act(async () => control('첫 번째 진의').click())

  await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ equipment: [], oathUpgrade: [] }))
  expect(upgradeLevelText()).toBe(MISSING_VALUE)

  await act(async () => control('세 번째 진의').click())

  await vi.waitFor(() =>
    expect(bodies.at(-1)).toEqual({
      equipment: [],
      oathUpgrade: [1, 2, 3].map((step) => ({ step, option: upgradeOptionOf(step, 'Damage') }))
    })
  )
  expect(upgradeLevelText()).toBe('3단계')
  expect(control('두 번째 진의').getAttribute('aria-checked')).toBe('true')
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

it('아바타 줄은 현재 착용 아바타를, 스위칭 줄은 버프 강화 스킬 이름과 지금 레벨, 지금 등록한 짙편린 부위 수를 보인다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  expect(rowValueOf('아바타')).toBe('현재 착용 아바타')
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨, 짙편린 0부위')
})

it('딜러가 버프 강화 장비에 등록한 짙편린 수를 스위칭 줄과 짙편린 칸에 보인다', async () => {
  await render(withSwitchingEquipment(characterDetailFixture('dealer'), 9))
  await waitForScores(UNCHANGED_SCORES)

  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨, 짙편린 9부위')

  await choose('스위칭')

  expect((control('짙편린 부위 수') as HTMLInputElement).value).toBe('9')
})

it('버퍼는 주 버프 스킬의 지금 레벨만 스위칭 줄에 보이고 짙편린 칸이 없다', async () => {
  await render(characterDetailFixture('buffer'))

  await vi.waitFor(() => expect(rowValueOf('스위칭')).toBe('러블리 템포 30레벨'))

  await choose('스위칭')

  expect(has('스위칭 레벨')).toBe(true)
  expect(has('짙편린 부위 수')).toBe(false)
})

it('종결 아바타 프리셋이 없는 전직에는 아바타 줄만 없다', async () => {
  const detail = characterDetailFixture('dealer')
  await render({ ...detail, character: { ...detail.character, jobGrowId: 'unknown-job-grow' } })
  await waitForScores(UNCHANGED_SCORES)

  expect(etcNames()).toEqual(['스위칭', '묵언의 진의'])
})

it('버프 강화 스킬을 바꿀 수 없는 캐릭터에는 스위칭 줄만 없다', async () => {
  const detail = characterDetailFixture('dealer')
  await render({ ...detail, buff: { ...detail.buff, equipment: null } })
  await waitForScores(UNCHANGED_SCORES)

  expect(etcNames()).toEqual(['아바타', '묵언의 진의'])
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
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 20레벨, 짙편린 0부위')
  expect(resetButton().disabled).toBe(false)

  await pick('스위칭 레벨', '16레벨')

  await waitForScores(UNCHANGED_SCORES)
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨, 짙편린 0부위')
  expect(resetButton().disabled).toBe(true)
})

it('딜러가 짙편린 칸에서 부위 수를 12까지 올리면 그 수를 요청하고, 지금 등록한 수로 돌아오면 원본 점수로 돌아간다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('스위칭')

  expect(container.querySelectorAll('aside .label')[1]?.textContent).toBe('짙편린')
  expect((control('짙편린 부위 수') as HTMLInputElement).value).toBe('0')
  expect(control('짙편린 부위 수 내리기').hasAttribute('disabled')).toBe(true)

  await step('짙편린 부위 수 올리기', 12)

  await waitForScores(ONE_CHOICE_SCORES)
  expect(bodies.at(-1)).toEqual({ equipment: [], switchingEquipment: 12 })
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨, 짙편린 12부위')
  expect(control('짙편린 부위 수 올리기').hasAttribute('disabled')).toBe(true)
  expect(resetButton().disabled).toBe(false)

  await step('짙편린 부위 수 내리기', 12)

  await waitForScores(UNCHANGED_SCORES)
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨, 짙편린 0부위')
  expect(resetButton().disabled).toBe(true)
})

it('아바타 줄에서 종결 아바타와 엠블렘을 고르면 프리셋을 요청하고, 현재 착용 아바타로 돌아오면 원본 점수로 돌아간다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)

  await choose('아바타')

  expect(editorTitle()).toBe('아바타')
  expect(buttonNames('아바타')).toEqual(['현재 착용 아바타', '종결 아바타와 엠블렘'])
  expect(pressedIn('아바타')).toBe('현재 착용 아바타')

  await press('아바타', '종결 아바타와 엠블렘')

  await waitForScores(ONE_CHOICE_SCORES)
  expect(bodies.at(-1)).toEqual({ equipment: [], avatarPreset: 'best' })
  expect(rowValueOf('아바타')).toBe('종결 아바타와 엠블렘')

  await press('아바타', '현재 착용 아바타')

  await waitForScores(UNCHANGED_SCORES)
  expect(rowValueOf('아바타')).toBe('현재 착용 아바타')
  expect(resetButton().disabled).toBe(true)
})

it('초기화하면 고른 아바타 프리셋, 스위칭 레벨과 짙편린 부위 수를 함께 되돌린다', async () => {
  await render(characterDetailFixture('dealer'))
  await waitForScores(UNCHANGED_SCORES)
  await choose('아바타')
  await press('아바타', '종결 아바타와 엠블렘')
  await choose('스위칭')
  await pick('스위칭 레벨', '12레벨')
  await step('짙편린 부위 수 올리기', 2)
  await waitForScores([
    ['현재', '1,000,000'],
    ['변경 후', '1,003,000'],
    ['차이', '+3,000']
  ])
  expect(bodies.at(-1)).toEqual({
    equipment: [],
    avatarPreset: 'best',
    buffLevel: 12,
    switchingEquipment: 2
  })

  await act(async () => resetButton().click())

  await waitForScores(UNCHANGED_SCORES)
  expect(rowValueOf('아바타')).toBe('현재 착용 아바타')
  expect(rowValueOf('스위칭')).toBe('광적인 믿음 16레벨, 짙편린 0부위')
  expect(control('스위칭 레벨').textContent).toBe('16레벨')
  expect((control('짙편린 부위 수') as HTMLInputElement).value).toBe('0')
})
