// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView, CharacterHistory } from '#entities/character'
import { apiFailure, characterUrl } from '#pages/character/api/character.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { HistoryTab } from './HistoryTab'

const FIRST = '2026-11-05T13:00:00.000Z'
const MIDDLE = '2026-11-13T11:40:00.000Z'
const LATEST = '2026-11-17T13:09:00.000Z'
const IDENTITY = { serverId: 'cain', characterId: 'character-1' }
const HISTORY_URL = characterUrl(IDENTITY, '/history')
const SNAPSHOT_URL = characterUrl(IDENTITY, '/history/snapshot')

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-17T13:30:00.000Z'))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    }
  )
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

function detailOf(
  setPoint: number | null = null,
  mistLevel: number | null = null
): CharacterDetailView {
  return {
    character: {
      serverId: 'cain',
      characterId: 'character-1',
      characterName: '하늘',
      serverName: '카인',
      level: 115,
      jobId: null,
      jobGrowId: null,
      jobName: null,
      jobGrowName: null,
      fame: null,
      adventureName: null,
      guildId: null,
      guildName: null
    },
    freshness: { lastSuccessfulFetchAt: LATEST },
    card: null,
    equipment: {
      equipment: [],
      setItemInfo: [
        {
          setItemId: null,
          setItemName: null,
          setItemRarityName: null,
          active: { setPoint: { current: setPoint, min: null, max: null }, status: [] }
        }
      ]
    },
    creature: null,
    avatar: [],
    mistAssimilation: { level: mistLevel, expRate: null, status: [] },
    oath: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    status: { status: [], buff: [] }
  }
}

const NAME_CHANGES: CharacterHistory['nameChanges'] = [
  { kind: 'character', at: '2025-01-23T13:52:00.000Z', before: '하늘', after: '바다' },
  { kind: 'adventure', at: '2026-01-28T19:29:00.000Z', before: '모험단2', after: '모험단1' }
]

const EMPTY: CharacterHistory = {
  basics: [],
  scores: [],
  sectionChanges: {},
  nameChanges: NAME_CHANGES,
  changes: []
}

const ONE: CharacterHistory = {
  basics: [{ observedAt: FIRST, fame: 134861 }],
  scores: [{ observedAt: FIRST, calculator: 'equipment', value: 1268402 }],
  sectionChanges: { equipment: [FIRST] },
  nameChanges: [],
  changes: [{ observedAt: FIRST, first: true, items: [] }]
}

const TWO: CharacterHistory = {
  basics: [
    { observedAt: FIRST, fame: 134861 },
    { observedAt: LATEST, fame: 136647 }
  ],
  scores: [
    { observedAt: FIRST, calculator: 'equipment', value: 1268402 },
    { observedAt: LATEST, calculator: 'equipment', value: 1369647 }
  ],
  sectionChanges: { equipment: [FIRST, LATEST], avatar: [FIRST] },
  nameChanges: [],
  changes: [
    { observedAt: FIRST, first: true, items: [] },
    {
      observedAt: LATEST,
      first: false,
      items: [
        {
          kind: 'equipment',
          slotId: 'WEAPON',
          slotName: '무기',
          itemName: '검은 질병의 멸룡검 발뭉',
          itemRarity: '태초',
          replaced: null,
          fields: [{ field: 'refine', name: null, before: 7, after: 8 }]
        },
        {
          kind: 'equipment',
          slotId: 'JACKET',
          slotName: '상의',
          itemName: '긍휼 속 자비의 상의',
          itemRarity: '에픽',
          replaced: null,
          fields: [{ field: 'enchant', name: '최종 데미지 증가', before: '1%', after: '3%' }]
        }
      ]
    }
  ]
}

const THREE: CharacterHistory = {
  ...TWO,
  sectionChanges: { equipment: [FIRST, MIDDLE, LATEST], avatar: [FIRST] },
  basics: [
    { observedAt: FIRST, fame: 134861 },
    { observedAt: MIDDLE, fame: 135980 },
    { observedAt: LATEST, fame: 136647 }
  ],
  scores: [
    { observedAt: FIRST, calculator: 'equipment', value: 1268402 },
    { observedAt: MIDDLE, calculator: 'equipment', value: 1338770 },
    { observedAt: LATEST, calculator: 'equipment', value: 1369647 }
  ],
  changes: [
    ...TWO.changes.slice(0, 1),
    {
      observedAt: MIDDLE,
      first: false,
      items: [
        {
          kind: 'equipment',
          slotId: 'SHOES',
          slotName: '신발',
          itemName: '고요한 안식의 신발',
          itemRarity: '에픽',
          replaced: null,
          fields: [{ field: 'reinforce', name: null, before: 11, after: 12 }]
        }
      ]
    },
    ...TWO.changes.slice(1)
  ]
}

function render(): Promise<void> {
  return act(async () =>
    root.render(
      <TestQueryClient>
        <HistoryTab detail={detailOf()} />
      </TestQueryClient>
    )
  )
}

async function renderLoaded(
  history: CharacterHistory,
  snapshots: Readonly<Record<string, CharacterDetailView>> = {}
): Promise<string[]> {
  const requestedAt: string[] = []
  server.use(
    http.get(HISTORY_URL, () => HttpResponse.json(history)),
    http.get(SNAPSHOT_URL, ({ request }) => {
      const at = new URL(request.url).searchParams.get('at') ?? ''
      requestedAt.push(at)
      const snapshot = snapshots[at]

      if (snapshot === undefined) {
        return apiFailure(404, 'CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
      }

      return HttpResponse.json(snapshot)
    })
  )
  await render()
  await vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())

  return requestedAt
}

function text(selector: string): string[] {
  return [...container.querySelectorAll(selector)].map((element) => element.textContent ?? '')
}

function tiles(): string[][] {
  return [...container.querySelectorAll('dl > div')].map((tile) =>
    [...tile.children].map((cell) => cell.textContent ?? '')
  )
}

function pointButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]
}

it('받는 동안 받는 중을 알리고, 받지 못하면 이력을 받지 못했다고 알린다', async () => {
  const { promise, resolve } = Promise.withResolvers<void>()
  const requested: string[] = []
  server.use(
    http.get(HISTORY_URL, async ({ request }) => {
      requested.push(request.url)
      await promise

      return apiFailure(500, 'INTERNAL_SERVER_ERROR', '서버 오류로 이력을 처리하지 못했습니다.')
    })
  )
  await render()

  expect(text('[role="status"]')).toEqual(['이력을 받는 중입니다.'])

  resolve()

  await vi.waitFor(() => expect(text('[role="alert"]')).toEqual(['이력을 받지 못했습니다.']))
  expect(requested).toEqual([HISTORY_URL])
})

it('이력이 없으면 빈 상태 제목과 최신 순 이름 변경 표만 보인다', async () => {
  await renderLoaded(EMPTY)

  expect(text('p')).toEqual(['저장된 이력이 없습니다.'])
  expect(container.querySelector('svg')).toBeNull()
  expect(text('h2')).toEqual(['이름 변경2'])
  expect(text('tbody tr')).toEqual([
    '2026-01-29 04:29모험단명모험단2→모험단1',
    '2025-01-23 22:52캐릭터명하늘→바다'
  ])
})

it('한 시점뿐이어도 명성과 점수 차트, 첫 기록 시점과 요약 숫자를 보인다', async () => {
  await renderLoaded(ONE, { [FIRST]: detailOf(2555, 100) })

  expect(
    [...container.querySelectorAll('section[aria-label$="추이"]')].map(({ ariaLabel }) => ariaLabel)
  ).toEqual(['명성 추이', '장비 점수 추이'])
  expect(text('h2')).toEqual(['시점1', '변경점1'])
  expect(text('button[aria-pressed="true"]')).toEqual(['11-05 22:00첫 기록134,8611,268,402'])
  expect(tiles()).toEqual([
    ['명성', '134,861', '-'],
    ['장비 점수', '1,268,402', '-'],
    ['세트 포인트', '2,555pt', '-'],
    ['안개 융화', 'Lv 100', '-']
  ])
  expect(text('ul li')).toContain('첫 기록')
})

it('여러 시점이면 최신 시점을 골라 두 차트와 직전 시점 대비 증감, 변경점, 그대로를 보인다', async () => {
  await renderLoaded(TWO, { [FIRST]: detailOf(2500, 99), [LATEST]: detailOf(2555, 100) })

  expect(
    [...container.querySelectorAll('section[aria-label$="추이"]')].map(({ ariaLabel }) => ariaLabel)
  ).toEqual(['명성 추이', '장비 점수 추이'])
  expect(text('button[aria-pressed]')).toEqual([
    '11-17 22:09무기, 상의136,6471,369,647',
    '11-05 22:00첫 기록134,8611,268,402'
  ])
  expect(tiles()).toEqual([
    ['명성', '136,647', '+1,786'],
    ['장비 점수', '1,369,647', '+101,245'],
    ['세트 포인트', '2,555pt', '+55pt'],
    ['안개 융화', 'Lv 100', '+1']
  ])
  expect(text('h2')).toEqual(['시점2', '변경점2', '그대로'])
  expect(text('ul li')).toEqual(
    expect.arrayContaining([
      '무기검은 질병의 멸룡검 발뭉재련7→8',
      '상의긍휼 속 자비의 상의마법부여최종 데미지 증가+1%→+3%'
    ])
  )
  expect(text('ul li')).toEqual(
    expect.arrayContaining(['아바타', '크리쳐', '서약', '스킬', '버프 강화', '안개 융화'])
  )
  expect(text('ul li')).not.toContain('장비')
})

it('다른 시점을 고르면 그 시점과 직전 시점의 상세를 받아 요약 숫자와 증감, 변경점을 그 시점 값으로 바꾼다', async () => {
  await renderLoaded(THREE, {
    [FIRST]: detailOf(2500, 99),
    [MIDDLE]: detailOf(2520, 100),
    [LATEST]: detailOf(2555, 100)
  })

  await act(async () => pointButtons()[1]?.click())

  expect(text('button[aria-pressed="true"]')).toEqual(['11-13 20:40신발135,9801,338,770'])
  await vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
  expect(tiles()).toEqual([
    ['명성', '135,980', '+1,119'],
    ['장비 점수', '1,338,770', '+70,368'],
    ['세트 포인트', '2,520pt', '+20pt'],
    ['안개 융화', 'Lv 100', '+1']
  ])
  expect(text('ul li')).toContain('신발고요한 안식의 신발강화+11→+12')
  expect(text('ul li')).not.toContain('무기검은 질병의 멸룡검 발뭉재련7→8')
})

it('고른 시점의 상세를 받지 못하면 그 자리에만 실패를 알린다', async () => {
  const requestedAt = await renderLoaded(TWO, { [LATEST]: detailOf(2555, 100) })

  await act(async () => pointButtons()[1]?.click())

  expect(text('button[aria-pressed="true"]')).toEqual(['11-05 22:00첫 기록134,8611,268,402'])
  await vi.waitFor(() => expect(text('[role="alert"]')).toEqual(['시점 요약을 받지 못했습니다.']))
  expect(requestedAt).toContain(FIRST)
  expect(text('h2')).toEqual(['시점2'])
})
