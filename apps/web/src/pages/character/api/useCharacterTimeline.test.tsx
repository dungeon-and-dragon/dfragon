// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  CharacterDetailView,
  CharacterIdentity,
  CharacterTimeline,
  TimelineAcquisition
} from '#entities/character'
import type { TimelinePages } from '#pages/character/hooks/useTimelinePages'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { apiFailure, characterUrl } from '#entities/character-detail/api/character-detail.handlers'
import {
  type CharacterTimelineResult,
  useCharacterTimeline,
  useTimelineAcquisitions
} from './useCharacterTimeline'

const identity: CharacterIdentity = { serverId: 'cain', characterId: 'character-1' }

const detail: CharacterDetailView = {
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

const filled: CharacterTimeline = {
  seasonClears: [{ kind: 'raid', name: '디레지에 레이드', hard: true, count: 3 }],
  enhancements: [
    {
      kind: 'refine',
      itemId: 'item-1',
      itemName: '합성 무기',
      itemRarity: '태초',
      before: null,
      after: 8,
      result: true,
      safe: null,
      occurredAt: '2026-11-04T10:00:00.000Z'
    }
  ],
  enhancementsCursor: 'enhancement-cursor',
  acquisitions: [
    {
      code: 505,
      name: '아이템 획득(던전 드랍)',
      itemId: 'item-2',
      itemName: '합성 상의',
      itemRarity: '에픽',
      occurredAt: '2026-11-03T10:00:00.000Z'
    }
  ],
  acquisitionsCursor: 'acquisition-cursor'
}

const empty: CharacterTimeline = {
  seasonClears: [],
  enhancements: [],
  enhancementsCursor: null,
  acquisitions: [],
  acquisitionsCursor: null
}

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

function respond(path: string, reply: () => HttpResponse<object>): void {
  const url = characterUrl(identity, path)
  server.use(
    http.get(url, ({ request }) => {
      requested.push(request.url)

      return reply()
    })
  )
}

function TimelineHarness({
  onResult
}: {
  onResult: (result: CharacterTimelineResult) => void
}): null {
  const result = useCharacterTimeline(detail)
  useEffect(() => onResult(result))

  return null
}

async function readTimeline(): Promise<CharacterTimelineResult> {
  let latest: CharacterTimelineResult = { status: 'loading' }
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TimelineHarness
          onResult={(result) => {
            latest = result
          }}
        />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(latest.status).not.toBe('loading'))

  return latest
}

it.each([
  ['값이 있는 응답', filled],
  ['빈 응답', empty]
])('%s을 그대로 읽고 캐릭터의 timeline 경로를 부른다', async (_name, timeline) => {
  respond('/timeline', () => HttpResponse.json(timeline))

  await expect(readTimeline()).resolves.toEqual({ status: 'success', timeline })
  expect(requested).toEqual([characterUrl(identity, '/timeline')])
})

it('400 INVALID_CHARACTER_QUERY의 error.message를 오류 문구로 준다', async () => {
  const message = 'API가 보낸 잘못된 캐릭터 문구'
  respond('/timeline', () => apiFailure(400, 'INVALID_CHARACTER_QUERY', message))

  await expect(readTimeline()).resolves.toEqual({ status: 'error', message })
})

it('timeline 경로가 없는 API의 404 NOT_FOUND는 응답 확인 실패 문구로 끝난다', async () => {
  respond('/timeline', () =>
    apiFailure(404, 'NOT_FOUND', 'Cannot GET /characters/cain/character-1/timeline')
  )

  await expect(readTimeline()).resolves.toEqual({
    status: 'error',
    message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
  })
})

function AcquisitionsHarness({
  onPages
}: {
  onPages: (pages: TimelinePages<TimelineAcquisition>) => void
}): null {
  const pages = useTimelineAcquisitions(identity, filled)
  useEffect(() => onPages(pages))

  return null
}

it('이어 받기 응답의 행이 타임라인 형식과 다르면 응답 확인 실패 문구로 끝난다', async () => {
  respond('/timeline/acquisitions', () =>
    HttpResponse.json({
      items: [{ ...filled.acquisitions[0], itemRarity: '레전더리' }],
      nextCursor: null
    })
  )
  let latest: TimelinePages<TimelineAcquisition> | undefined
  await act(async () =>
    root.render(
      <AcquisitionsHarness
        onPages={(pages) => {
          latest = pages
        }}
      />
    )
  )

  await act(async () => latest?.loadMore())

  await vi.waitFor(() =>
    expect(latest?.state).toEqual({
      status: 'error',
      message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
    })
  )
  expect(latest?.items).toEqual(filled.acquisitions)
  expect(requested).toEqual([
    `${characterUrl(identity, '/timeline/acquisitions')}?before=acquisition-cursor`
  ])
})
