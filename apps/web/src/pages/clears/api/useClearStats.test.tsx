// @vitest-environment jsdom
import { HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { storyClearContentStats, storyClearOverview, storyClearStats } from './clears.fixture'
import { CLEAR_CONTENT_STATS_URL, CLEAR_OVERVIEW_URL, CLEAR_STATS_URL } from './clears.handlers'
import { useClearContentStats, useClearOverview, useClearStats } from './useClearStats'

const INVALID_RESPONSE = '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
const WEEK = '2026-11-05'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<unknown>
let paths: string[]

beforeEach(() => {
  result = { status: 'loading' }
  paths = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function Harness({ read }: { read: () => LoadedResult<unknown> }): null {
  const value = read()
  useEffect(() => {
    result = value
  })

  return null
}

function respond(url: string, body: JsonBodyType): void {
  server.use(
    http.get(url, ({ request }) => {
      paths.push(new URL(request.url).pathname)

      return HttpResponse.json(body)
    })
  )
}

async function settle(read: () => LoadedResult<unknown>): Promise<LoadedResult<unknown>> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness read={read} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  return result
}

const michaelaHard = storyClearContentStats('michaela-hard', WEEK)

it('컨텐츠 id의 경로 문자를 encode해 한 경로 조각으로 보낸다', async () => {
  respond(CLEAR_CONTENT_STATS_URL, michaelaHard)

  await settle(() => useClearContentStats('a/b c', WEEK))

  expect(paths.map((path) => path.split('/').at(-1))).toEqual(['a%2Fb%20c'])
})

it('수집한 주가 없거나 챌린지인 컨텐츠 집계는 week와 레이드 전용 통계를 null로 읽는다', async () => {
  const empty = {
    ...storyClearContentStats('engraved-nightmare-1', WEEK),
    week: null,
    jobs: [],
    adventures: [],
    weeklyClears: [],
    fameBands: [],
    weekOverWeek: null,
    weekMoves: null,
    streaks: null,
    stages: null,
    scoreBands: { equipment: [], buff: [] },
    weekdays: [],
    hours: []
  }
  respond(CLEAR_CONTENT_STATS_URL, empty)

  await expect(settle(() => useClearContentStats('engraved-nightmare-1', WEEK))).resolves.toEqual({
    status: 'success',
    value: empty
  })
})

const [content] = storyClearStats.contents
const [week] = content.weeks

it.each<[string, JsonBodyType]>([
  ['모르는 종류', { ...storyClearStats, contents: [{ ...content, kind: 'world-boss' }] }],
  [
    '날짜가 아닌 주',
    {
      ...storyClearStats,
      contents: [{ ...content, weeks: [{ ...week, weekStart: '2026-11-05T00:00:00.000Z' }] }]
    }
  ]
])('클리어 집계 목록에 %s가 있으면 응답 확인 실패 문구로 끝낸다', async (_name, body) => {
  respond(CLEAR_STATS_URL, body)

  await expect(settle(useClearStats)).resolves.toEqual({
    status: 'error',
    message: INVALID_RESPONSE
  })
})

it('0명 모험단이 있는 컨텐츠 집계는 응답 확인 실패 문구로 끝낸다', async () => {
  respond(CLEAR_CONTENT_STATS_URL, {
    ...michaelaHard,
    adventures: [{ characters: 0, adventures: 1 }]
  })

  await expect(settle(() => useClearContentStats('michaela-hard', WEEK))).resolves.toEqual({
    status: 'error',
    message: INVALID_RESPONSE
  })
})

const overview = storyClearOverview(WEEK)

it.each<[string, JsonBodyType]>([
  ['요일이 1부터 7 밖인', { ...overview, weekdays: [{ weekday: 0, cleared: 30 }] }],
  [
    '분포 값이 빠진',
    { ...overview, contents: [{ ...overview.contents[0], fame: { median: 122000 } }] }
  ]
])('%s 전체 개요는 응답 확인 실패 문구로 끝낸다', async (_name, body) => {
  respond(CLEAR_OVERVIEW_URL, body)

  await expect(settle(() => useClearOverview(WEEK))).resolves.toEqual({
    status: 'error',
    message: INVALID_RESPONSE
  })
})
