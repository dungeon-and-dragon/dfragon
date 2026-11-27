// @vitest-environment jsdom
import { delay, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  CharacterDetailView,
  CharacterTimeline,
  TimelineAcquisition,
  TimelineEnhancement
} from '#entities/character'
import { apiFailure, characterUrl } from '#entities/character-detail/api/character-detail.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TimelineTab } from './TimelineTab'

// jsdom은 색을 계산하지 않으므로 색 utility class가 붙었는지로 색을 확인한다.
const tones = {
  reinforce: 'text-game-enhance',
  amplify: 'text-game-amplify',
  refine: 'text-game-refine',
  success: 'text-fg-success',
  failure: 'text-fg-danger',
  epic: 'text-rarity-epic',
  primordial: 'text-rarity-primordial'
} as const

function hasTone(element: Element, tone: keyof typeof tones): boolean {
  return element.className.split(' ').includes(tones[tone])
}

function detailOf(characterId = 'character-1'): CharacterDetailView {
  return {
    character: {
      serverId: 'cain',
      characterId,
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
    freshness: { lastSuccessfulFetchAt: '2026-11-09T05:08:00.000Z' },
    card: null,
    equipment: { equipment: [], setItemInfo: [] },
    creature: null,
    avatar: [],
    mistAssimilation: null,
    oath: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    status: { status: [], buff: [] }
  }
}

const EMPTY: CharacterTimeline = {
  seasonClears: [],
  enhancements: [],
  enhancementsCursor: null,
  acquisitions: [],
  acquisitionsCursor: null
}

const FILLED: CharacterTimeline = {
  seasonClears: [
    { kind: 'raid', name: '디레지에 레이드', hard: true, count: 3 },
    { kind: 'raid', name: '나벨 레이드', hard: true, count: 2 },
    { kind: 'raid', name: '나벨 레이드', hard: false, count: 1 },
    { kind: 'legion', name: '베누스', hard: false, count: 12 }
  ],
  enhancements: [
    {
      kind: 'reinforce',
      itemId: 'item-1',
      itemName: '합성 무기',
      itemRarity: '에픽',
      before: 13,
      after: 14,
      result: true,
      safe: true,
      occurredAt: '2026-11-04T01:02:00.000Z'
    },
    {
      kind: 'amplify',
      itemId: 'item-2',
      itemName: '합성 상의',
      itemRarity: '태초',
      before: 10,
      after: 0,
      result: false,
      safe: false,
      occurredAt: '2026-11-03T23:59:00.000Z'
    },
    {
      kind: 'refine',
      itemId: 'item-1',
      itemName: '합성 무기',
      itemRarity: '에픽',
      before: null,
      after: 8,
      result: true,
      safe: null,
      occurredAt: '2026-11-03T00:00:00.000Z'
    }
  ],
  enhancementsCursor: null,
  acquisitions: [
    {
      code: 505,
      name: '아이템 획득(던전 드랍)',
      itemId: 'item-3',
      itemName: '합성 하의',
      itemRarity: '태초',
      occurredAt: '2026-11-02T10:00:00.000Z'
    },
    {
      code: 550,
      name: '항아리 획득',
      itemId: 'item-4',
      itemName: '합성 신발',
      itemRarity: '에픽',
      occurredAt: '2026-11-01T10:00:00.000Z'
    }
  ],
  acquisitionsCursor: null
}

const TIMEOUT_MESSAGE = '캐릭터 정보 조회 시간이 초과됐습니다. 다시 시도해 주세요.'

type Reply = () => HttpResponse<object> | Promise<HttpResponse<object>>

let container: HTMLDivElement
let root: Root
let requested: string[]

beforeEach(() => {
  requested = []
  // 2026-11-06 12:00 KST. 타이머는 그대로 두고 지금 시각만 고정한다.
  vi.useFakeTimers({ now: new Date('2026-11-06T03:00:00.000Z'), toFake: ['Date'] })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function characterPathUrl(path: string, characterId = 'character-1'): string {
  return characterUrl({ serverId: 'cain', characterId }, path)
}

function timelineUrl(): string {
  return characterPathUrl('/timeline')
}

function pageUrl(list: 'enhancements' | 'acquisitions', before: string): string {
  return `${characterPathUrl(`/timeline/${list}`)}?before=${before}`
}

// 응답마다 한 번만 쓰는 handler를 넣어, 응답을 정하지 않은 요청은 handler 없는 요청으로 테스트를 실패시킨다.
function respond(path: string, replies: readonly Reply[], characterId = 'character-1'): void {
  server.use(
    ...replies.map((reply) =>
      http.get(
        characterPathUrl(path, characterId),
        ({ request }) => {
          requested.push(request.url)

          return reply()
        },
        { once: true }
      )
    )
  )
}

function json(body: object): Reply {
  return () => HttpResponse.json(body)
}

function timeoutFailure(): Reply {
  return () => apiFailure(504, 'NEOPLE_TIMEOUT', TIMEOUT_MESSAGE)
}

function after(gate: Promise<void>, reply: Reply): Reply {
  return async () => {
    await gate

    return reply()
  }
}

function render(detail: CharacterDetailView | null): Promise<void> {
  return act(async () =>
    root.render(
      <TestQueryClient>{detail !== null && <TimelineTab detail={detail} />}</TestQueryClient>
    )
  )
}

// 탭 패널을 숨기면 탭 내용만 unmount되고 화면 위의 캐시는 남는다.
function hide(): Promise<void> {
  return render(null)
}

async function settled(): Promise<void> {
  await vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
}

async function open(detail: CharacterDetailView): Promise<void> {
  await render(detail)
  await settled()
}

function group(title: string): HTMLElement {
  return container.querySelector<HTMLElement>(`section[aria-label="${title}"]`)!
}

function headerOf(title: string): string[] {
  return [...group(title).querySelectorAll('h2 > span')].map((span) => span.textContent ?? '')
}

function rowsOf(title: string): string[][] {
  return [...group(title).querySelectorAll('li, tbody tr')].map((row) =>
    [...row.querySelectorAll(':scope > *')].map((cell) => cell.textContent ?? '')
  )
}

function moreButton(title: string): HTMLButtonElement | undefined {
  return [...group(title).querySelectorAll('button')].find(
    (button) => button.textContent === '불러오기'
  )
}

function clickMore(title: string): Promise<void> {
  return act(async () => moreButton(title)!.click())
}

async function loadMore(title: string): Promise<void> {
  await clickMore(title)
  await settled()
}

function cellsOf(title: string, row: number): HTMLElement[] {
  return [...group(title).querySelectorAll<HTMLElement>('tbody tr')[row].querySelectorAll('td')]
}

it('받는 동안 받는 중을 알리고, 받은 뒤 묶음을 시즌, 강화, 획득 순으로 그리고 이번 주 클리어는 두지 않는다', async () => {
  const { promise, resolve } = Promise.withResolvers<void>()
  respond('/timeline', [after(promise, json(FILLED))])
  await render(detailOf())

  expect(container.querySelector('[role="status"]')?.textContent).toContain('타임라인을 받는 중')

  resolve()
  await settled()

  expect(container.querySelector('[role="status"]')).toBeNull()
  expect([...container.querySelectorAll('section')].map((section) => section.ariaLabel)).toEqual([
    '이번 시즌 클리어',
    '강화, 증폭, 재련',
    '획득'
  ])
  expect(requested).toEqual([timelineUrl()])
})

it('시즌 클리어는 종류 뒤 하드 배지로 나눈 횟수 칩을 보이며, 하드 배지는 붉은색이다', async () => {
  respond('/timeline', [json(FILLED)])
  await open(detailOf())

  expect(rowsOf('이번 시즌 클리어')).toEqual([
    ['레이드', '하드', '디레지에 레이드', '3'],
    ['레이드', '하드', '나벨 레이드', '2'],
    ['레이드', '나벨 레이드', '1'],
    ['레기온', '베누스', '12']
  ])

  const hardBadges = [...container.querySelectorAll('span')].filter(
    (badge) => badge.textContent === '하드'
  )

  expect(hardBadges).toHaveLength(2)
  expect(hardBadges.every((badge) => badge.classList.contains('text-fg-danger'))).toBe(true)
})

it('강화 표는 종류별 색, 등급 색 장비, 전과 후 수치(재련은 후 수치만), 결과 색과 안전 배지를 보인다', async () => {
  respond('/timeline', [json(FILLED)])
  await open(detailOf())

  expect(rowsOf('강화, 증폭, 재련')).toEqual([
    ['2일 전', '강화', '합성 무기', '13 → 14', '성공안전'],
    ['2일 전', '증폭', '합성 상의', '10 → 0', '실패'],
    ['3일 전', '재련', '합성 무기', '8', '성공']
  ])
  const kinds = [0, 1, 2].map((row) => cellsOf('강화, 증폭, 재련', row)[1])
  expect(kinds.map((cell) => hasTone(cell, 'reinforce'))).toEqual([true, false, false])
  expect(kinds.map((cell) => hasTone(cell, 'amplify'))).toEqual([false, true, false])
  expect(kinds.map((cell) => hasTone(cell, 'refine'))).toEqual([false, false, true])

  const [success, failure] = [0, 1].map(
    (row) => cellsOf('강화, 증폭, 재련', row)[4].querySelector('span > span')!
  )
  expect([hasTone(success, 'success'), hasTone(success, 'failure')]).toEqual([true, false])
  expect([hasTone(failure, 'success'), hasTone(failure, 'failure')]).toEqual([false, true])

  const items = [0, 1].map((row) => cellsOf('강화, 증폭, 재련', row)[2].firstElementChild!)
  expect([hasTone(items[0], 'epic'), hasTone(items[1], 'primordial')]).toEqual([true, true])
})

it('획득 표는 제목 옆에 개수와 에픽, 태초를 적고 경로는 이름의 괄호 안 글자만, 괄호가 없으면 이름을 보인다', async () => {
  respond('/timeline', [json(FILLED)])
  await open(detailOf())

  expect(headerOf('획득')).toEqual(['획득', '2', '에픽, 태초'])
  expect(rowsOf('획득')).toEqual([
    ['3일 전', '합성 하의', '던전 드랍'],
    ['4일 전', '합성 신발', '항아리 획득']
  ])
})

it('값이 없는 캐릭터는 세 묶음의 제목을 남기고 묶음마다 빈 상태 한 줄을 보인다', async () => {
  respond('/timeline', [json(EMPTY)])
  await open(detailOf())

  const groups = [...container.querySelectorAll('section')]
  expect(groups.map((section) => headerOf(section.ariaLabel!)[1])).toEqual(['0', '0', '0'])
  expect(groups.map((section) => section.querySelector('p')?.textContent)).toEqual([
    '이번 시즌 클리어 기록이 없습니다.',
    '강화, 증폭, 재련 기록이 없습니다.',
    '에픽, 태초 획득 기록이 없습니다.'
  ])
  expect(container.querySelectorAll('li, table')).toHaveLength(0)
})

it('탭을 숨겼다가 다시 열거나 같은 캐릭터의 상세를 새로 받아도 캐시가 남은 동안 다시 조회하지 않는다', async () => {
  respond('/timeline', [json(FILLED)])

  await open(detailOf())
  await hide()
  await render(detailOf())

  expect(rowsOf('이번 시즌 클리어')).toHaveLength(4)
  expect(requested).toEqual([timelineUrl()])
})

it('조회가 실패하면 오류 문구를 보이고, 탭을 다시 열면 다시 조회한다', async () => {
  respond('/timeline', [timeoutFailure(), json(EMPTY)])
  const detail = detailOf()

  await open(detail)
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(TIMEOUT_MESSAGE)

  await hide()
  await render(detail)
  await vi.waitFor(() => expect(container.querySelectorAll('section')).toHaveLength(3))
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(requested).toEqual([timelineUrl(), timelineUrl()])
})

it('다른 캐릭터로 바뀐 뒤 늦게 온 이전 캐릭터의 응답은 무시한다', async () => {
  const first = Promise.withResolvers<void>()
  const second = Promise.withResolvers<void>()
  respond('/timeline', [after(first.promise, json(FILLED))], 'character-1')
  respond('/timeline', [after(second.promise, json(EMPTY))], 'character-2')

  await render(detailOf('character-1'))
  await render(detailOf('character-2'))
  // 두 요청이 handler에 닿는 순서는 정해지지 않으므로 순서 없이 본다.
  await vi.waitFor(() =>
    expect([...requested].sort()).toEqual([
      characterPathUrl('/timeline', 'character-1'),
      characterPathUrl('/timeline', 'character-2')
    ])
  )
  second.resolve()
  await settled()
  // 늦은 응답이 도착해 화면에 반영될 틈을 준 뒤에도 지금 캐릭터를 보이는지 본다.
  first.resolve()
  await act(async () => delay(50))

  expect(container.querySelectorAll('section')).toHaveLength(3)
  expect(container.querySelector('section p')?.textContent).toBe(
    '이번 시즌 클리어 기록이 없습니다.'
  )
  expect(container.querySelectorAll('li, table')).toHaveLength(0)
})

function enhancement(itemName: string): TimelineEnhancement {
  return { ...FILLED.enhancements[0], itemName }
}

function acquisition(itemName: string): TimelineAcquisition {
  return { ...FILLED.acquisitions[0], itemName }
}

function itemNames(title: string): string[] {
  return [...group(title).querySelectorAll('tbody tr')].map(
    (row) => row.querySelectorAll('td')[title === '획득' ? 1 : 2].textContent ?? ''
  )
}

const PAGED: CharacterTimeline = {
  ...EMPTY,
  enhancements: [enhancement('첫 강화')],
  enhancementsCursor: 'enhancement-cursor-1',
  acquisitions: [acquisition('첫 획득')],
  acquisitionsCursor: 'acquisition-cursor-1'
}

it('강화, 획득 목록은 받아 둔 줄이 모자라면 불러오기를 눌렀을 때 그 목록의 cursor로 다음 묶음을 받아 뒤에 붙이고, cursor가 없으면 불러오기를 두지 않는다', async () => {
  respond('/timeline', [json(PAGED)])
  respond('/timeline/enhancements', [
    json({ items: [enhancement('둘째 강화')], nextCursor: 'enhancement-cursor-2' }),
    json({ items: [enhancement('셋째 강화')], nextCursor: null })
  ])
  respond('/timeline/acquisitions', [json({ items: [acquisition('둘째 획득')], nextCursor: null })])
  await open(detailOf())

  await loadMore('강화, 증폭, 재련')
  await loadMore('강화, 증폭, 재련')

  expect(itemNames('강화, 증폭, 재련')).toEqual(['첫 강화', '둘째 강화', '셋째 강화'])
  expect(moreButton('강화, 증폭, 재련')).toBeUndefined()
  expect(headerOf('강화, 증폭, 재련')).toEqual(['강화, 증폭, 재련', '3'])
  expect(itemNames('획득')).toEqual(['첫 획득'])
  expect(requested).toEqual([
    timelineUrl(),
    pageUrl('enhancements', 'enhancement-cursor-1'),
    pageUrl('enhancements', 'enhancement-cursor-2')
  ])

  await loadMore('획득')

  expect(itemNames('획득')).toEqual(['첫 획득', '둘째 획득'])
  expect(moreButton('획득')).toBeUndefined()
  expect(requested).toEqual([
    timelineUrl(),
    pageUrl('enhancements', 'enhancement-cursor-1'),
    pageUrl('enhancements', 'enhancement-cursor-2'),
    pageUrl('acquisitions', 'acquisition-cursor-1')
  ])
})

it('강화, 증폭, 재련은 처음 10줄만 보이고 다음 묶음이 없으면 불러오기로 받아 둔 나머지 줄만 보인다', async () => {
  const twelve = Array.from({ length: 12 }, (_, index) => enhancement(`강화 ${index + 1}`))
  respond('/timeline', [json({ ...EMPTY, enhancements: twelve })])
  await open(detailOf())

  expect(itemNames('강화, 증폭, 재련')).toHaveLength(10)

  await loadMore('강화, 증폭, 재련')

  expect(itemNames('강화, 증폭, 재련')).toHaveLength(12)
  expect(moreButton('강화, 증폭, 재련')).toBeUndefined()
  expect(requested).toEqual([timelineUrl()])
})

it('다음 묶음을 받는 동안 불러오기 대신 받는 중을 알리고, 실패하면 오류와 다시 시도를 보이고 다시 시도하면 같은 cursor로 받는다', async () => {
  const pending = Promise.withResolvers<void>()
  respond('/timeline', [json(PAGED)])
  respond('/timeline/enhancements', [
    after(pending.promise, timeoutFailure()),
    json({ items: [enhancement('둘째 강화')], nextCursor: null })
  ])
  await open(detailOf())

  await clickMore('강화, 증폭, 재련')

  expect(moreButton('강화, 증폭, 재련')).toBeUndefined()
  expect(group('강화, 증폭, 재련').querySelector('[role="status"]')?.textContent).toBe(
    '기록을 더 받는 중입니다.'
  )

  pending.resolve()
  await settled()

  expect(group('강화, 증폭, 재련').querySelector('[role="status"]')).toBeNull()
  expect(group('강화, 증폭, 재련').querySelector('[role="alert"]')?.textContent).toBe(
    TIMEOUT_MESSAGE
  )
  expect(itemNames('강화, 증폭, 재련')).toEqual(['첫 강화'])
  expect(moreButton('강화, 증폭, 재련')).toBeUndefined()

  await act(async () => group('강화, 증폭, 재련').querySelector('button')!.click())
  await settled()

  expect(group('강화, 증폭, 재련').querySelector('[role="alert"]')).toBeNull()
  expect(itemNames('강화, 증폭, 재련')).toEqual(['첫 강화', '둘째 강화'])
  expect(requested).toEqual([
    timelineUrl(),
    pageUrl('enhancements', 'enhancement-cursor-1'),
    pageUrl('enhancements', 'enhancement-cursor-1')
  ])
})

it('5분이 지나 다시 연 탭은 받아 둔 타임라인을 먼저 그리고, 새로 받은 첫 페이지로 바꾸며 그 전에 이어 받던 묶음은 붙이지 않는다', async () => {
  const startedAt = Date.now()
  const refetched = Promise.withResolvers<void>()
  const nextPage = Promise.withResolvers<void>()
  respond('/timeline', [
    json(PAGED),
    after(refetched.promise, json({ ...PAGED, enhancements: [enhancement('새 첫 강화')] }))
  ])
  respond('/timeline/enhancements', [
    after(nextPage.promise, json({ items: [enhancement('둘째 강화')], nextCursor: null }))
  ])

  await open(detailOf())
  await hide()
  vi.setSystemTime(startedAt + 6 * 60_000)
  await render(detailOf())
  expect(itemNames('강화, 증폭, 재련')).toEqual(['첫 강화'])

  await clickMore('강화, 증폭, 재련')
  // 다시 받는 첫 페이지와 다음 묶음 요청이 handler에 닿는 순서는 정해지지 않으므로 순서 없이 본다.
  await vi.waitFor(() =>
    expect([...requested].sort()).toEqual([
      timelineUrl(),
      timelineUrl(),
      pageUrl('enhancements', 'enhancement-cursor-1')
    ])
  )
  refetched.resolve()
  await vi.waitFor(() => expect(itemNames('강화, 증폭, 재련')).toEqual(['새 첫 강화']))

  // 늦은 다음 묶음이 도착해 화면에 반영될 틈을 준 뒤에도 새 첫 페이지만 보이는지 본다.
  nextPage.resolve()
  await act(async () => delay(50))
  expect(itemNames('강화, 증폭, 재련')).toEqual(['새 첫 강화'])
  expect(requested).toHaveLength(3)
})
