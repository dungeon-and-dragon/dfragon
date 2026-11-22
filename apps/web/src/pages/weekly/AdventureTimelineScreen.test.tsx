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
const clear: AdventureTimelineItem = {
  ...cain,
  type: 'clear',
  kind: 'raid',
  name: '합성 레이드',
  modeName: '합성 단계',
  hard: true,
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

it('모험단 캐릭터들의 강화, 드랍, 레이드 클리어를 한 표에 캐릭터, 종류, 대상, 내용으로 보이고 캐릭터 이름이 상세로 이어진다', async () => {
  serve(() => ({ items: [amplify, acquisition, clear], nextCursor: null }))
  await render({})
  await vi.waitFor(() => expect(rows()).toHaveLength(3))

  expect(rows()).toEqual([
    ['합성검사', '증폭', '합성 대검', '10 → 11실패안전'],
    ['합성법사', '드랍', '합성 상의', '레이드 카드 보상'],
    ['합성검사', '클리어', '합성 레이드', '하드합성 단계']
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
  expect(
    [...container.querySelectorAll('[role="group"][aria-label="종류"] button')].map(
      (chip) => chip.textContent
    )
  ).toEqual(['전체', '강화', '드랍', '클리어'])
  await act(async () => button('클리어').click())
  await act(async () => button('전체').click())
  expect(changes).toEqual([{ kind: 'clear' }, { kind: undefined }])
})

it('불러오기를 누르면 cursor 뒤의 기록을 이어 붙이고, 더 없으면 버튼을 숨긴다', async () => {
  serve((search) => {
    if (search.get('before') === 'cursor-1') {
      return { items: [clear], nextCursor: null }
    }

    return { items: [amplify, acquisition], nextCursor: 'cursor-1' }
  })
  await render({ kind: 'enhancement' })
  await vi.waitFor(() => expect(rows()).toHaveLength(2))
  await act(async () => button('불러오기').click())
  await vi.waitFor(() => expect(rows()).toHaveLength(3))

  expect(requests).toEqual(['?kind=enhancement', '?kind=enhancement&before=cursor-1'])
  expect(button('불러오기')).toBeUndefined()
})

it('기록이 없으면 빈 상태 한 줄을 보인다', async () => {
  serve(() => ({ items: [], nextCursor: null }))
  await render({})

  await vi.waitFor(() => expect(container.textContent).toContain('기록이 없습니다.'))
  expect(container.querySelector('table')).toBeNull()
})
