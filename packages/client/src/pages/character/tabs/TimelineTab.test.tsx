// @vitest-environment jsdom
import { colors } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import type {
  CharacterTimeline,
  TimelineAcquisition,
  TimelineEnhancement,
  TimelinePage
} from '@dfragon/client-core/shared/search/character-timeline'
import { ClientHostContext, type ClientHost } from '../../../host/client-host'
import { createTestClientHost } from '../../../testing/test-support/client-host'
import { TestQueryClient } from '../../../testing/test-support/test-query-client'
import { TimelineTab } from './TimelineTab'

// jsdom은 색을 계산하지 않으므로 같은 선언으로 만든 StyleX class가 붙었는지로 색을 확인한다.
const tones = stylex.create({
  reinforce: { color: colors.gameEnhance },
  amplify: { color: colors.gameAmplify },
  refine: { color: colors.gameRefine },
  success: { color: colors.fgSuccess },
  failure: { color: colors.fgDanger },
  epic: { color: colors.rarityEpic },
  primordial: { color: colors.rarityPrimordial }
})

function hasTone(element: Element, tone: keyof typeof tones): boolean {
  return element.className.split(' ').includes(stylex.props(tones[tone]).className ?? '')
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
  weeklyClears: [],
  seasonClears: [],
  enhancements: [],
  enhancementsCursor: null,
  acquisitions: [],
  acquisitionsCursor: null
}

const FILLED: CharacterTimeline = {
  weeklyClears: [
    {
      kind: 'raid',
      name: '디레지에 레이드',
      modeName: '디레지에 : 악연',
      hard: true,
      occurredAt: '2026-11-05T12:30:00.000Z'
    },
    {
      kind: 'raid',
      name: '나벨 레이드',
      modeName: '나벨 : 무지의 악',
      hard: false,
      occurredAt: '2026-11-05T13:00:00.000Z'
    },
    {
      kind: 'legion',
      name: '베누스',
      modeName: null,
      hard: false,
      occurredAt: '2026-11-05T15:05:00.000Z'
    }
  ],
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

let container: HTMLDivElement
let root: Root
let observed: { callback: IntersectionObserverCallback; target: Element }[]

class FakeIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element): void {
    observed.push({ callback: this.callback, target })
  }
  disconnect(): void {
    observed = observed.filter((entry) => entry.callback !== this.callback)
  }
}

beforeEach(() => {
  observed = []
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
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
  vi.unstubAllGlobals()
})

function render(host: ClientHost, detail: CharacterDetailView | null): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={host}>
        <TestQueryClient>{detail !== null && <TimelineTab detail={detail} />}</TestQueryClient>
      </ClientHostContext>
    )
  )
}

// 탭 패널을 숨기면 탭 내용만 unmount되고 화면 위의 캐시는 남는다.
function hide(host: ClientHost): Promise<void> {
  return render(host, null)
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

function reachEnd(title: string): Promise<void> {
  return act(async () => {
    for (const { callback, target } of observed) {
      if (group(title).contains(target)) {
        callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as never)
      }
    }
  })
}

function cellsOf(title: string, row: number): HTMLElement[] {
  return [...group(title).querySelectorAll<HTMLElement>('tbody tr')[row].querySelectorAll('td')]
}

it('받는 동안 받는 중을 알리고, 받은 뒤 묶음을 이번 주, 시즌, 강화, 획득 순으로 그린다', async () => {
  const { promise, resolve } = Promise.withResolvers<CharacterTimeline>()
  const host = createTestClientHost({ getCharacterTimeline: vi.fn(() => promise) })
  await render(host, detailOf())

  expect(container.querySelector('[role="status"]')?.textContent).toContain('타임라인을 받는 중')

  await act(async () => resolve(FILLED))

  expect(container.querySelector('[role="status"]')).toBeNull()
  expect([...container.querySelectorAll('section')].map((section) => section.ariaLabel)).toEqual([
    '이번 주 클리어',
    '시즌 클리어 횟수',
    '강화, 증폭, 재련',
    '획득'
  ])
  expect(host.getCharacterTimeline).toHaveBeenCalledExactlyOnceWith({
    serverId: 'cain',
    characterId: 'character-1'
  })
})

it('이번 주 클리어는 종류, 이름, 하드 배지와 난이도(없으면 생략), 지난 시간을 보이고 한국 시간 MM-DD HH:mm은 title로 두며, 시즌은 하드를 나눈 횟수 칩을 보인다', async () => {
  await render(createTestClientHost({ getCharacterTimeline: async () => FILLED }), detailOf())

  expect(headerOf('이번 주 클리어')).toEqual(['이번 주 클리어', '3'])
  expect(rowsOf('이번 주 클리어')).toEqual([
    ['레이드', '디레지에 레이드', '하드', '디레지에 : 악연', '14시간 전'],
    ['레이드', '나벨 레이드', '나벨 : 무지의 악', '14시간 전'],
    ['레기온', '베누스', '11시간 전']
  ])
  expect(
    [...group('이번 주 클리어').querySelectorAll('time')].map((time) => [time.dateTime, time.title])
  ).toEqual([
    ['2026-11-05T12:30:00.000Z', '11-05 21:30'],
    ['2026-11-05T13:00:00.000Z', '11-05 22:00'],
    ['2026-11-05T15:05:00.000Z', '11-06 00:05']
  ])
  expect(rowsOf('시즌 클리어 횟수')).toEqual([
    ['레이드', '디레지에 레이드', '하드', '3'],
    ['레이드', '나벨 레이드', '하드', '2'],
    ['레이드', '나벨 레이드', '1'],
    ['레기온', '베누스', '12']
  ])
})

it('강화 표는 종류별 색, 등급 색 장비, 전과 후 수치(재련은 후 수치만), 결과 색과 안전 배지를 보인다', async () => {
  await render(createTestClientHost({ getCharacterTimeline: async () => FILLED }), detailOf())

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
  await render(createTestClientHost({ getCharacterTimeline: async () => FILLED }), detailOf())

  expect(headerOf('획득')).toEqual(['획득', '2', '에픽, 태초'])
  expect(rowsOf('획득')).toEqual([
    ['3일 전', '합성 하의', '던전 드랍'],
    ['4일 전', '합성 신발', '항아리 획득']
  ])
})

it('값이 없는 캐릭터는 네 묶음의 제목을 남기고 묶음마다 빈 상태 한 줄을 보인다', async () => {
  await render(createTestClientHost({ getCharacterTimeline: async () => EMPTY }), detailOf())

  const groups = [...container.querySelectorAll('section')]
  expect(groups.map((section) => headerOf(section.ariaLabel!)[1])).toEqual(['0', '0', '0', '0'])
  expect(groups.map((section) => section.querySelector('p')?.textContent)).toEqual([
    '이번 주 클리어 기록이 없습니다.',
    '이번 시즌 클리어 기록이 없습니다.',
    '강화, 증폭, 재련 기록이 없습니다.',
    '에픽, 태초 획득 기록이 없습니다.'
  ])
  expect(container.querySelectorAll('li, table')).toHaveLength(0)
})

it('탭을 숨겼다가 다시 열거나 같은 캐릭터의 상세를 새로 받아도 캐시가 남은 동안 다시 조회하지 않는다', async () => {
  const getCharacterTimeline = vi.fn<ClientHost['getCharacterTimeline']>(async () => FILLED)
  const host = createTestClientHost({ getCharacterTimeline })

  await render(host, detailOf())
  await hide(host)
  await render(host, detailOf())

  expect(rowsOf('이번 주 클리어')).toHaveLength(3)
  expect(getCharacterTimeline).toHaveBeenCalledOnce()
})

it('조회가 실패하면 오류 문구를 보이고, 탭을 다시 열면 다시 조회한다', async () => {
  const getCharacterTimeline = vi
    .fn<ClientHost['getCharacterTimeline']>()
    .mockRejectedValueOnce(new Error('검색 시간이 초과됐습니다. 다시 시도해 주세요.'))
    .mockResolvedValueOnce(EMPTY)
  const host = createTestClientHost({ getCharacterTimeline })
  const detail = detailOf()

  await render(host, detail)
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    '검색 시간이 초과됐습니다. 다시 시도해 주세요.'
  )

  await hide(host)
  await render(host, detail)
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(container.querySelectorAll('section')).toHaveLength(4)
  expect(getCharacterTimeline).toHaveBeenCalledTimes(2)
})

it('다른 캐릭터로 바뀐 뒤 늦게 온 이전 캐릭터의 응답은 무시한다', async () => {
  const pending = new Map<string, PromiseWithResolvers<CharacterTimeline>>()
  const getCharacterTimeline = vi.fn<ClientHost['getCharacterTimeline']>(({ characterId }) => {
    const request = Promise.withResolvers<CharacterTimeline>()
    pending.set(characterId, request)

    return request.promise
  })
  const host = createTestClientHost({ getCharacterTimeline })

  await render(host, detailOf('character-1'))
  await render(host, detailOf('character-2'))
  await act(async () => pending.get('character-2')!.resolve(EMPTY))
  await act(async () => pending.get('character-1')!.resolve(FILLED))

  expect(container.querySelectorAll('section')).toHaveLength(4)
  expect(container.querySelector('section p')?.textContent).toBe('이번 주 클리어 기록이 없습니다.')
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

it('강화, 획득 목록의 끝이 화면에 들어오면 그 목록의 cursor로 다음 묶음을 받아 뒤에 붙이고, cursor가 없으면 더 받지 않는다', async () => {
  const getTimelineEnhancements = vi
    .fn<ClientHost['getTimelineEnhancements']>()
    .mockResolvedValueOnce({
      items: [enhancement('둘째 강화')],
      nextCursor: 'enhancement-cursor-2'
    })
    .mockResolvedValueOnce({ items: [enhancement('셋째 강화')], nextCursor: null })
  const getTimelineAcquisitions = vi
    .fn<ClientHost['getTimelineAcquisitions']>()
    .mockResolvedValueOnce({ items: [acquisition('둘째 획득')], nextCursor: null })
  const host = createTestClientHost({
    getCharacterTimeline: async () => PAGED,
    getTimelineEnhancements,
    getTimelineAcquisitions
  })
  await render(host, detailOf())

  await reachEnd('강화, 증폭, 재련')
  await reachEnd('강화, 증폭, 재련')

  expect(itemNames('강화, 증폭, 재련')).toEqual(['첫 강화', '둘째 강화', '셋째 강화'])
  expect(headerOf('강화, 증폭, 재련')).toEqual(['강화, 증폭, 재련', '3'])
  expect(getTimelineEnhancements.mock.calls).toEqual([
    [{ serverId: 'cain', characterId: 'character-1' }, 'enhancement-cursor-1'],
    [{ serverId: 'cain', characterId: 'character-1' }, 'enhancement-cursor-2']
  ])
  expect(itemNames('획득')).toEqual(['첫 획득'])
  expect(getTimelineAcquisitions).not.toHaveBeenCalled()

  await reachEnd('획득')
  await reachEnd('강화, 증폭, 재련')
  await reachEnd('획득')

  expect(itemNames('획득')).toEqual(['첫 획득', '둘째 획득'])
  expect(getTimelineAcquisitions).toHaveBeenCalledExactlyOnceWith(
    { serverId: 'cain', characterId: 'character-1' },
    'acquisition-cursor-1'
  )
  expect(getTimelineEnhancements).toHaveBeenCalledTimes(2)
  expect(observed).toHaveLength(0)
})

it('다음 묶음을 받는 동안 받는 중을 알리고 끝을 다시 지나도 겹쳐 받지 않으며, 실패하면 오류와 다시 시도를 보이고 다시 시도하면 같은 cursor로 받는다', async () => {
  const pending = Promise.withResolvers<TimelinePage<TimelineEnhancement>>()
  const getTimelineEnhancements = vi
    .fn<ClientHost['getTimelineEnhancements']>()
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ items: [enhancement('둘째 강화')], nextCursor: null })
  const host = createTestClientHost({
    getCharacterTimeline: async () => PAGED,
    getTimelineEnhancements
  })
  await render(host, detailOf())

  await reachEnd('강화, 증폭, 재련')
  await reachEnd('강화, 증폭, 재련')

  expect(group('강화, 증폭, 재련').querySelector('[role="status"]')?.textContent).toBe(
    '기록을 더 받는 중입니다.'
  )
  expect(getTimelineEnhancements).toHaveBeenCalledOnce()

  await act(async () => pending.reject(new Error('검색 시간이 초과됐습니다. 다시 시도해 주세요.')))

  expect(group('강화, 증폭, 재련').querySelector('[role="status"]')).toBeNull()
  expect(group('강화, 증폭, 재련').querySelector('[role="alert"]')?.textContent).toBe(
    '검색 시간이 초과됐습니다. 다시 시도해 주세요.'
  )
  expect(itemNames('강화, 증폭, 재련')).toEqual(['첫 강화'])
  expect(observed.some(({ target }) => group('강화, 증폭, 재련').contains(target))).toBe(false)

  await act(async () => group('강화, 증폭, 재련').querySelector('button')!.click())

  expect(group('강화, 증폭, 재련').querySelector('[role="alert"]')).toBeNull()
  expect(itemNames('강화, 증폭, 재련')).toEqual(['첫 강화', '둘째 강화'])
  expect(getTimelineEnhancements.mock.calls.map(([, before]) => before)).toEqual([
    'enhancement-cursor-1',
    'enhancement-cursor-1'
  ])
})

it('5분이 지나 다시 연 탭은 받아 둔 타임라인을 먼저 그리고, 새로 받은 첫 페이지로 바꾸며 그 전에 이어 받던 묶음은 붙이지 않는다', async () => {
  const startedAt = Date.now()
  const refetched = Promise.withResolvers<CharacterTimeline>()
  const nextPage = Promise.withResolvers<TimelinePage<TimelineEnhancement>>()
  const getCharacterTimeline = vi
    .fn<ClientHost['getCharacterTimeline']>()
    .mockResolvedValueOnce(PAGED)
    .mockReturnValueOnce(refetched.promise)
  const getTimelineEnhancements = vi.fn<ClientHost['getTimelineEnhancements']>(
    () => nextPage.promise
  )
  const host = createTestClientHost({ getCharacterTimeline, getTimelineEnhancements })

  await render(host, detailOf())
  await hide(host)
  vi.setSystemTime(startedAt + 6 * 60_000)
  await render(host, detailOf())
  expect(itemNames('강화, 증폭, 재련')).toEqual(['첫 강화'])

  await reachEnd('강화, 증폭, 재련')
  expect(getTimelineEnhancements).toHaveBeenCalledExactlyOnceWith(
    { serverId: 'cain', characterId: 'character-1' },
    'enhancement-cursor-1'
  )
  await act(async () => refetched.resolve({ ...PAGED, enhancements: [enhancement('새 첫 강화')] }))
  expect(itemNames('강화, 증폭, 재련')).toEqual(['새 첫 강화'])

  await act(async () => nextPage.resolve({ items: [enhancement('둘째 강화')], nextCursor: null }))
  expect(itemNames('강화, 증폭, 재련')).toEqual(['새 첫 강화'])
  expect(getCharacterTimeline).toHaveBeenCalledTimes(2)
})
