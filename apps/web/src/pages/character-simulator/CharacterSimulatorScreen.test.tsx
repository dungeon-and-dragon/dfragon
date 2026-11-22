// @vitest-environment jsdom
import { enchantOptionsOf } from '@dfragon/lib/enchant-grades'
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
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

// 바꾼 부위의 강화 수치 합만큼 점수를 더해, 어떤 요청에 대한 응답인지 화면 숫자로 구분한다.
function scoresFor({ equipment }: SimulationBody): Response {
  const added = equipment.reduce((sum, { reinforce }) => sum + reinforce, 0)

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
