// @vitest-environment jsdom
import { delay, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureWeekly, WeeklyCharacter } from '#entities/adventure-guild'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { ADVENTURE_ACTIVITY_URL, ADVENTURE_WEEKLY_URL } from './api/adventure.handlers'
import { AdventureEntryScreen, WeeklyScreen } from './WeeklyScreen'

let container: HTMLDivElement
let root: Root
let requested: string[]

beforeEach(() => {
  requested = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function weeklyCharacter(
  index: number,
  weeklyClears: WeeklyCharacter['weeklyClears'],
  score: WeeklyCharacter['score'] = null,
  sets: Pick<WeeklyCharacter, 'equipmentSet' | 'oathSet'> = { equipmentSet: null, oathSet: null }
): WeeklyCharacter {
  return {
    serverId: 'cain',
    characterId: `character-${index}`,
    characterName: `합성${index}`,
    adventureName: '합성 모험단',
    level: 115,
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    jobName: '합성 직업',
    jobGrowName: '眞 합성 전직',
    fame: 90000 - index,
    guildId: null,
    guildName: null,
    role: null,
    score,
    ...sets,
    weeklyClears
  }
}

const weekly: AdventureWeekly = {
  adventureName: '합성 모험단',
  clearNames: [
    { kind: 'raid', name: '디레지에 레이드' },
    { kind: 'raid', name: '무너진 성자 미카엘라' },
    { kind: 'legion', name: '다 레기온' }
  ],
  characters: [
    weeklyCharacter(
      1,
      [
        { kind: 'raid', name: '무너진 성자 미카엘라' },
        { kind: 'legion', name: '다 레기온' }
      ],
      { calculator: 'buff', value: 4_120_000, approximate: null },
      {
        equipmentSet: { id: 'synthetic-set', name: '합성 장비 세트' },
        oathSet: { id: 1, name: '합성 서약', option: null }
      }
    ),
    weeklyCharacter(2, [])
  ]
}

type Reply = () => Response | Promise<Response>

function failure(): Response {
  return HttpResponse.json(
    { error: { code: 'INTERNAL_SERVER_ERROR', message: '합성 오류' } },
    { status: 500 }
  )
}

async function pending(): Promise<Response> {
  await delay('infinite')

  return failure()
}

function record(request: Request): void {
  const path = decodeURIComponent(request.url.slice(API_BASE_URL.length))
  requested.push(`${request.method} ${path}`)
}

// 앞의 응답은 한 번씩 쓰고 마지막 응답은 그 뒤 요청에도 계속 쓴다.
function serve(url: string, replies: readonly Reply[]): void {
  server.use(
    ...replies.map((reply, index) =>
      http.get(
        url,
        ({ request }) => {
          record(request)

          return reply()
        },
        { once: index < replies.length - 1 }
      )
    )
  )
}

function render(screen: React.JSX.Element): Promise<void> {
  return act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>{screen}</TestRouter>
      </TestQueryClient>
    )
  )
}

function renderWeekly(
  adventureName: string,
  weeklyReplies: readonly Reply[],
  {
    activityReplies = [pending],
    onAdventureOpen = vi.fn()
  }: { activityReplies?: readonly Reply[]; onAdventureOpen?: (adventureName: string) => void } = {}
): Promise<void> {
  server.use(oathCatalogHandlers.notUploaded)
  serve(ADVENTURE_WEEKLY_URL, weeklyReplies)
  serve(ADVENTURE_ACTIVITY_URL, activityReplies)

  return render(
    <WeeklyScreen
      adventureName={adventureName}
      season={undefined}
      onSeasonChange={vi.fn()}
      onAdventureOpen={onAdventureOpen}
    />
  )
}

function respondWeekly(body: AdventureWeekly): Reply {
  return () => HttpResponse.json(body)
}

function listName(): string | null | undefined {
  return container.querySelector('section h2')?.textContent
}

function headerRows(): string[][] {
  return [...container.querySelectorAll('thead tr')].map((row) =>
    [...row.querySelectorAll('th')].map((cell) => cell.textContent ?? '')
  )
}

function bodyRows(): string[][] {
  return [...container.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
}

function clearMarks(): boolean[][] {
  return [...container.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].slice(-3).map((cell) => cell.querySelector('svg') !== null)
  )
}

function characterLinks(): number {
  return container.querySelectorAll('tbody a').length
}

function button(name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find(
    (item) => item.textContent === name || item.getAttribute('aria-label') === name
  )
}

async function submitName(name: string): Promise<void> {
  const form = container.querySelector<HTMLFormElement>('form')!
  const input = form.querySelector<HTMLInputElement>('input[aria-label="모험단"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => form.requestSubmit())
}

it('모험단 이름 입력 화면은 제목 한 줄과 빈 입력, 보기 버튼만 두고 조회하지 않는다', async () => {
  await render(<AdventureEntryScreen onAdventureOpen={vi.fn()} />)

  expect(container.querySelector('h1')?.textContent).toBe('모험단')
  expect(container.querySelector<HTMLInputElement>('input[aria-label="모험단"]')?.value).toBe('')
  expect(container.querySelector('nav[aria-label="시즌"]')).toBeNull()
  expect(container.querySelector('section')).toBeNull()
  expect(container.querySelector('p')).toBeNull()
  expect(button('보기')).toBeDefined()
  expect(button('갱신')).toBeUndefined()
  expect(requested).toEqual([])
})

it('모험단 화면의 입력은 지금 모험단 이름으로 시작하고, 보기를 누르면 앞뒤 공백을 뺀 이름을 열며 빈 이름은 열지 않는다', async () => {
  const onAdventureOpen = vi.fn()
  await renderWeekly('합성 모험단', [respondWeekly(weekly)], { onAdventureOpen })
  expect(container.querySelector<HTMLInputElement>('input[aria-label="모험단"]')?.value).toBe(
    '합성 모험단'
  )

  await submitName('  ')
  expect(onAdventureOpen).not.toHaveBeenCalled()
  await submitName(' 다른 모험단 ')

  expect(onAdventureOpen.mock.calls).toEqual([['다른 모험단']])
})

it('표 위에 제목 없이 한 줄 헤더에 세트 열과 줄인 레이드 이름의 클리어 열을 응답 순서로 두고, 응답 순서의 캐릭터마다 세트, 점수와 클리어한 칸의 체크를 두며 값이 없으면 -다', async () => {
  await renderWeekly('합성 모험단', [respondWeekly(weekly)])
  await vi.waitFor(() => expect(characterLinks()).toBe(2))

  expect(listName()).toBeUndefined()
  expect(headerRows()).toEqual([
    ['#', '캐릭터', '세트', '명성', '점수', '디레지에', '미카엘라', '다 레기온']
  ])
  const [first, second] = bodyRows()
  expect(first.slice(2)).toEqual(['합성 장비 세트합성 서약', '89,999', '4,120,000', '', '', ''])
  expect(second.slice(2)).toEqual(['-', '89,998', '-', '', '', ''])
  expect(clearMarks()).toEqual([
    [false, true, true],
    [false, false, false]
  ])
  const link = container.querySelector<HTMLAnchorElement>('tbody a')!
  expect(link.textContent).toBe('합성1')
  expect(link.getAttribute('href')).toBe('/c/cain/character-1')
})

it('클리어 이름이 없는 응답은 #, 캐릭터, 세트, 명성, 점수 열만 그린다', async () => {
  await renderWeekly('합성 모험단', [
    respondWeekly({
      ...weekly,
      clearNames: [],
      characters: weekly.characters.map((character) => ({ ...character, weeklyClears: [] }))
    })
  ])
  await vi.waitFor(() => expect(characterLinks()).toBe(2))

  expect(headerRows()).toEqual([['#', '캐릭터', '세트', '명성', '점수']])
  expect(bodyRows()).toHaveLength(2)
})

it('캐릭터가 없는 응답은 모험단 이름 한 줄만 둔다', async () => {
  await renderWeekly('없는 모험단', [
    respondWeekly({ adventureName: '없는 모험단', clearNames: [], characters: [] })
  ])

  await vi.waitFor(() => expect(listName()).toBe('없는 모험단'))
  expect(container.querySelector('section table')).toBeNull()
  expect(container.querySelector('section p')).toBeNull()
})

it('갱신을 누르면 다시 받는 동안 받아 둔 표와 받는 중 버튼을 두고, 두 요청이 모두 끝나면 새 주간 던파 표를 그리고 갱신 버튼은 꺼 둔다', async () => {
  const refreshedWeekly = Promise.withResolvers<Response>()
  const refreshedActivity = Promise.withResolvers<Response>()
  await renderWeekly(
    '합성 모험단',
    [
      respondWeekly({ ...weekly, characters: [weekly.characters[1]] }),
      () => refreshedWeekly.promise
    ],
    { activityReplies: [failure, () => refreshedActivity.promise] }
  )
  await vi.waitFor(() => {
    expect(characterLinks()).toBe(1)
    expect(requested).toHaveLength(2)
  })

  await act(async () => button('갱신')!.click())
  expect(button('받는 중')?.disabled).toBe(true)
  expect(container.querySelector('section [aria-busy="true"]')).toBeNull()
  expect(bodyRows()).toHaveLength(1)

  refreshedWeekly.resolve(HttpResponse.json(weekly))
  await vi.waitFor(() => expect(characterLinks()).toBe(2))
  expect(button('받는 중')?.disabled).toBe(true)

  refreshedActivity.resolve(failure())
  await vi.waitFor(() => expect(button('갱신')?.disabled).toBe(true))
  expect(requested.toSorted()).toEqual([
    'GET /adventures/합성 모험단/activity',
    'GET /adventures/합성 모험단/activity',
    'GET /adventures/합성 모험단/weekly',
    'GET /adventures/합성 모험단/weekly'
  ])
})

it('갱신이 실패하면 오류 문구 없이 받아 둔 표를 둔다', async () => {
  await renderWeekly('합성 모험단', [respondWeekly(weekly), failure], {
    activityReplies: [failure]
  })
  await vi.waitFor(() => {
    expect(characterLinks()).toBe(2)
    expect(requested).toHaveLength(2)
  })

  await act(async () => button('갱신')!.click())
  await vi.waitFor(() => {
    expect(button('받는 중')).toBeUndefined()
    expect(button('갱신')?.disabled).toBe(true)
  })

  expect(requested.filter((request) => request.endsWith('/weekly'))).toHaveLength(2)
  expect(bodyRows()).toHaveLength(2)
  expect(container.querySelector('section [role="alert"]')).toBeNull()
})

it('갱신 버튼은 누른 뒤 5분 동안 꺼 두고, 화면을 다시 그려도 그대로 두며 5분이 지나면 켠다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })

  try {
    const screen = (key: string) => (
      <WeeklyScreen
        key={key}
        adventureName="합성 모험단"
        season={undefined}
        onSeasonChange={vi.fn()}
        onAdventureOpen={vi.fn()}
      />
    )

    server.use(oathCatalogHandlers.notUploaded)
    serve(ADVENTURE_WEEKLY_URL, [respondWeekly(weekly)])
    serve(ADVENTURE_ACTIVITY_URL, [failure])
    await render(screen('first'))
    await vi.waitFor(() => expect(characterLinks()).toBe(2))

    await act(async () => button('갱신')!.click())
    await vi.waitFor(() => expect(button('갱신')?.disabled).toBe(true))

    await render(screen('second'))
    await act(async () => vi.advanceTimersByTime(5 * 60_000 - 1_000))
    expect(button('갱신')?.disabled).toBe(true)

    await act(async () => vi.advanceTimersByTime(1_000))
    expect(button('갱신')?.disabled).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})
