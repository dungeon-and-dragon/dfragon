// @vitest-environment jsdom
import { HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureWeekly } from '#entities/adventure-guild'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { ADVENTURE_WEEKLY_URL } from './adventure.handlers'
import { useAdventureWeekly } from './useAdventureWeekly'

const INVALID_QUERY = '검색 조건을 확인해 주세요.'
const INVALID_RESPONSE = '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<AdventureWeekly>
let requested: string[]

beforeEach(() => {
  result = { status: 'loading' }
  requested = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function Harness({ adventureName }: { adventureName: string }): null {
  const value = useAdventureWeekly(adventureName)
  useEffect(() => {
    result = value
  })

  return null
}

function respond(body: JsonBodyType): void {
  server.use(
    http.get(ADVENTURE_WEEKLY_URL, ({ request }) => {
      requested.push(request.url)

      return HttpResponse.json(body)
    })
  )
}

async function settle(adventureName: string): Promise<LoadedResult<AdventureWeekly>> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness adventureName={adventureName} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  return result
}

const weekly: AdventureWeekly = {
  adventureName: '합성 모험단',
  clearNames: [
    { kind: 'raid', name: '합성 레이드' },
    { kind: 'legion', name: '합성 레기온' }
  ],
  characters: [
    {
      serverId: 'cain',
      characterId: 'character-1',
      characterName: '합성 캐릭터',
      adventureName: '합성 모험단',
      level: 115,
      jobId: 'job-1',
      jobGrowId: 'grow-1',
      jobName: '합성 직업',
      jobGrowName: '眞 합성 전직',
      fame: 80123,
      guildId: null,
      guildName: null,
      role: null,
      score: null,
      weeklyClears: [{ kind: 'raid', name: '합성 레이드' }]
    }
  ]
}

it('모험단 이름을 encode해 한 경로 조각으로 담아 주간 클리어 응답을 읽는다', async () => {
  respond(weekly)

  await expect(settle('합성 모험단/1')).resolves.toEqual({ status: 'success', value: weekly })
  expect(requested).toEqual([
    `${API_BASE_URL}/adventures/${encodeURIComponent('합성 모험단/1')}/weekly`
  ])
})

it.each<[string, AdventureWeekly]>([
  [
    '클리어가 없는 응답',
    {
      ...weekly,
      clearNames: [],
      characters: weekly.characters.map((character) => ({ ...character, weeklyClears: [] }))
    }
  ],
  ['빈 응답', { adventureName: '없는 모험단', clearNames: [], characters: [] }]
])('%s도 읽는다', async (_name, body) => {
  respond(body)

  await expect(settle(body.adventureName)).resolves.toEqual({ status: 'success', value: body })
})

it('빈 이름은 요청하지 않고 검색 조건 문구로 거부한다', async () => {
  await expect(settle('  ')).resolves.toEqual({ status: 'error', message: INVALID_QUERY })
  expect(requested).toEqual([])
})

const { weeklyClears: _weeklyClears, ...withoutClears } = weekly.characters[0]!

it.each([
  ['모르는 클리어 종류', { ...weekly, clearNames: [{ kind: 'dungeon', name: '합성 던전' }] }],
  ['weeklyClears가 없는 캐릭터', { ...weekly, characters: [withoutClears] }]
])('%s가 있는 응답은 응답 확인 실패 문구로 거부한다', async (_name, body) => {
  respond(body)

  await expect(settle('합성 모험단')).resolves.toEqual({
    status: 'error',
    message: INVALID_RESPONSE
  })
})
