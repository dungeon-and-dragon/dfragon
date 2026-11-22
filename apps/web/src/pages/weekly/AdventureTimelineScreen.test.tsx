// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureTimelineItem, AdventureTimelinePage } from '#entities/adventure-guild'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { ADVENTURE_TIMELINE_URL } from './api/adventure.handlers'
import { AdventureTimelineScreen } from './AdventureTimelineScreen'
import type { TimelineSearch } from './timeline-search'

// 합성 캐릭터와 기록이다.
const cain = { serverId: 'cain', characterId: 'character-1', characterName: '합성검사' }
const siroco = { serverId: 'siroco', characterId: 'character-2', characterName: '합성법사' }

const amplify: AdventureTimelineItem = {
  ...cain,
  type: 'enhancement',
  kind: 'amplify',
  itemId: null,
  itemName: '합성 대검',
  itemRarity: '태초',
  before: 10,
  after: 11,
  result: false,
  safe: true,
  occurredAt: '2026-11-20T12:00:00.000Z'
}
const acquisition: AdventureTimelineItem = {
  ...siroco,
  type: 'acquisition',
  code: 505,
  name: '아이템 획득(레이드 카드 보상)',
  itemId: null,
  itemName: '합성 상의',
  itemRarity: '에픽',
  occurredAt: '2026-11-20T11:00:00.000Z'
}
const refine: AdventureTimelineItem = {
  ...cain,
  type: 'enhancement',
  kind: 'refine',
  itemId: null,
  itemName: '합성 대검',
  itemRarity: '태초',
  before: null,
  after: 8,
  result: true,
  safe: null,
  occurredAt: '2026-11-19T11:00:00.000Z'
}

let container: HTMLDivElement
let root: Root
let requests: string[]
let changes: TimelineSearch[]

beforeEach(() => {
  requests = []
  changes = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function serve(pageOf: (search: URLSearchParams) => AdventureTimelinePage): void {
  server.use(
    http.get(ADVENTURE_TIMELINE_URL, ({ request }) => {
      const { search, searchParams } = new URL(request.url)
      requests.push(search)

      return HttpResponse.json(pageOf(searchParams))
    })
  )
}

async function render(search: TimelineSearch): Promise<void> {
  function change(next: TimelineSearch): void {
    changes.push(next)
  }

  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <AdventureTimelineScreen
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

function rows(): string[][] {
  return [...container.querySelectorAll('section[aria-label="타임라인"] tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].slice(1).map((cell) => cell.textContent?.trim() ?? '')
  )
}

function button(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (each) => each.textContent === label
  )!
}

it('모험단 캐릭터들의 강화와 획득을 한 표에 캐릭터, 종류, 장비, 내용으로 보이고 캐릭터 이름이 상세로 이어진다', async () => {
  serve(() => ({ items: [amplify, acquisition, refine], nextCursor: null }))
  await render({})
  await vi.waitFor(() => expect(rows()).toHaveLength(3))

  expect(rows()).toEqual([
    ['합성검사', '증폭', '합성 대검', '10 → 11실패안전'],
    ['합성법사', '획득', '합성 상의', '레이드 카드 보상'],
    ['합성검사', '재련', '합성 대검', '8성공']
  ])
  expect(container.querySelector('tbody a')?.getAttribute('href')).toBe('/c/cain/character-1')
  expect(requests).toEqual([''])
  expect(button('불러오기')).toBeUndefined()
})

it('고른 종류를 kind로 보내고, 종류 칩을 누르면 그 종류로, 전체를 누르면 종류 없이 바꾼다', async () => {
  serve(() => ({ items: [acquisition], nextCursor: null }))
  await render({ kind: 'acquisition' })
  await vi.waitFor(() => expect(rows()).toHaveLength(1))

  expect(requests).toEqual(['?kind=acquisition'])
  await act(async () => button('증폭').click())
  await act(async () => button('전체').click())
  expect(changes).toEqual([{ kind: 'amplify' }, { kind: undefined }])
})

it('불러오기를 누르면 cursor 뒤의 기록을 이어 붙이고, 더 없으면 버튼을 숨긴다', async () => {
  serve((search) => {
    if (search.get('before') === 'cursor-1') {
      return { items: [refine], nextCursor: null }
    }

    return { items: [amplify, acquisition], nextCursor: 'cursor-1' }
  })
  await render({ kind: 'amplify' })
  await vi.waitFor(() => expect(rows()).toHaveLength(2))
  await act(async () => button('불러오기').click())
  await vi.waitFor(() => expect(rows()).toHaveLength(3))

  expect(requests).toEqual(['?kind=amplify', '?kind=amplify&before=cursor-1'])
  expect(button('불러오기')).toBeUndefined()
})

it('기록이 없으면 빈 상태 한 줄을 보인다', async () => {
  serve(() => ({ items: [], nextCursor: null }))
  await render({})

  await vi.waitFor(() => expect(container.textContent).toContain('기록이 없습니다.'))
  expect(container.querySelector('table')).toBeNull()
})
