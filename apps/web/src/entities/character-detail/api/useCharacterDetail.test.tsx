// @vitest-environment jsdom
import { delay, HttpResponse, http } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  CharacterDetailView,
  CharacterIdentity
} from '#entities/character/@x/character-detail'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { apiFailure, characterUrl } from './character-detail.handlers'
import {
  type CharacterDetailResult,
  useCharacterDetail,
  useRefreshCharacterDetail
} from './useCharacterDetail'

function Harness({ characterId }: { characterId: string }): React.JSX.Element {
  const result = useCharacterDetail('cain', characterId)
  switch (result.status) {
    case 'loading':
      return <output>loading</output>
    case 'success':
      return <output>{result.detail.character.characterName}</output>
    case 'error':
      return <output>{result.message}</output>
  }
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
  vi.useRealTimers()
})

function detailOf(characterId: string): CharacterDetailView {
  return {
    character: {
      serverId: 'cain',
      characterId,
      characterName: `이름-${characterId}`,
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

function identityOf(characterId: string): CharacterIdentity {
  return { serverId: 'cain', characterId }
}

function respondDetail(
  characterId: string,
  respond: () => Response | Promise<Response> = () => HttpResponse.json(detailOf(characterId))
): void {
  const url = characterUrl(identityOf(characterId))
  server.use(
    http.get(url, () => {
      requested.push(characterId)

      return respond()
    })
  )
}

function render(characterId: string | null): Promise<void> {
  return act(async () =>
    root.render(
      <TestQueryClient>
        {characterId !== null && <Harness characterId={characterId} />}
      </TestQueryClient>
    )
  )
}

function shown(): string | null {
  return container.querySelector('output')!.textContent
}

it('받는 동안 받는 중을 보이고, 같은 캐릭터를 다시 그려도 한 번만 조회한다', async () => {
  const { promise, resolve } = Promise.withResolvers<void>()
  respondDetail('character-1', async () => {
    await promise

    return HttpResponse.json(detailOf('character-1'))
  })

  await render('character-1')
  expect(shown()).toBe('loading')

  resolve()
  await vi.waitFor(() => expect(shown()).toBe('이름-character-1'))

  await render('character-1')
  expect(shown()).toBe('이름-character-1')
  expect(requested).toEqual(['character-1'])
})

it('다른 캐릭터로 바뀌면 다시 받는 중이 되고, 이전 캐릭터의 늦은 응답은 무시한다', async () => {
  const first = Promise.withResolvers<void>()
  const second = Promise.withResolvers<void>()
  respondDetail('character-1', async () => {
    await first.promise

    return HttpResponse.json(detailOf('character-1'))
  })
  respondDetail('character-2', async () => {
    await second.promise

    return HttpResponse.json(detailOf('character-2'))
  })

  await render('character-1')
  await render('character-2')
  expect(shown()).toBe('loading')

  second.resolve()
  await vi.waitFor(() => expect(shown()).toBe('이름-character-2'))

  // 늦은 응답이 도착해 화면에 반영될 틈을 준 뒤에도 지금 캐릭터를 보이는지 본다.
  first.resolve()
  await act(async () => delay(50))
  expect(shown()).toBe('이름-character-2')
})

it('화면을 떠났다 돌아와도 5분 동안은 다시 조회하지 않고, 5분이 지나면 다시 조회한다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const startedAt = Date.now()
  respondDetail('character-1')

  await render('character-1')
  await vi.waitFor(() => expect(shown()).toBe('이름-character-1'))
  await render(null)
  vi.setSystemTime(startedAt + 4 * 60_000)
  await render('character-1')
  expect(shown()).toBe('이름-character-1')
  expect(requested).toHaveLength(1)

  await render(null)
  vi.setSystemTime(startedAt + 6 * 60_000)
  await render('character-1')
  expect(shown()).toBe('이름-character-1')
  await vi.waitFor(() => expect(requested).toHaveLength(2))
})

it('응답의 캐릭터가 요청한 캐릭터가 아니면 응답 확인 실패 문구를 보인다', async () => {
  respondDetail('character-1', () => HttpResponse.json(detailOf('other-character')))

  await render('character-1')

  await vi.waitFor(() =>
    expect(shown()).toBe('검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.')
  )
})

// 문구는 API가 상세 경로에 보내는 문구와 같게 둔다.
it.each([
  [404, 'CHARACTER_NOT_FOUND', 'API가 보낸 없는 캐릭터 문구'],
  [400, 'INVALID_CHARACTER_QUERY', '캐릭터 조회 조건을 확인해 주세요.'],
  [500, 'INTERNAL_SERVER_ERROR', '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'],
  [502, 'NEOPLE_API_ERROR', '캐릭터 정보 조회 중 오류가 발생했습니다.'],
  [503, 'NEOPLE_UNAVAILABLE', '현재 캐릭터 정보를 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.'],
  [504, 'NEOPLE_TIMEOUT', '캐릭터 정보 조회 시간이 초과됐습니다. 다시 시도해 주세요.']
])('%i %s 응답이면 error.message를 그대로 보인다', async (status, code, message) => {
  respondDetail('missing-character', () => apiFailure(status, code, message))

  await render('missing-character')

  await vi.waitFor(() => expect(shown()).toBe(message))
})

it.each([
  ['Swagger에 없는 404 NEOPLE_API_ERROR', () => apiFailure(404, 'NEOPLE_API_ERROR', '문구')],
  ['Swagger에 없는 409 CHARACTER_NOT_FOUND', () => apiFailure(409, 'CHARACTER_NOT_FOUND', '문구')],
  ['JSON이 아닌 502', () => new HttpResponse('error code: 502', { status: 502 })]
])('%s 응답이면 API 문구 대신 응답 확인 실패 문구를 보인다', async (_name, respond) => {
  respondDetail('character-1', respond)

  await render('character-1')

  await vi.waitFor(() =>
    expect(shown()).toBe('검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.')
  )
})

type Refresh = ReturnType<typeof useRefreshCharacterDetail>

function RefreshHarness({
  onRender
}: {
  onRender: (value: { detail: CharacterDetailResult; refresh: Refresh }) => void
}): null {
  const detail = useCharacterDetail('cain', 'character-1')
  const refresh = useRefreshCharacterDetail()
  useEffect(() => onRender({ detail, refresh }))

  return null
}

it('다시 받기는 그 캐릭터의 refresh 경로로 POST하고, 받은 상세로 캐시를 바꾼다', async () => {
  const refreshed = {
    ...detailOf('character-1'),
    freshness: { lastSuccessfulFetchAt: '2026-11-09T06:00:00.000Z' }
  }
  const methods: string[] = []
  const refreshUrl = characterUrl(identityOf('character-1'), '/refresh')
  respondDetail('character-1')
  server.use(
    http.post(refreshUrl, ({ request }) => {
      methods.push(request.method)

      return HttpResponse.json(refreshed)
    })
  )
  let latest: { detail: CharacterDetailResult; refresh: Refresh } | undefined
  await act(async () =>
    root.render(
      <TestQueryClient>
        <RefreshHarness
          onRender={(value) => {
            latest = value
          }}
        />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(latest?.detail.status).toBe('success'))

  await act(async () => latest?.refresh.refresh(identityOf('character-1')))

  await vi.waitFor(() =>
    expect(latest?.detail).toMatchObject({
      status: 'success',
      detail: { freshness: { lastSuccessfulFetchAt: '2026-11-09T06:00:00.000Z' } }
    })
  )
  expect(methods).toEqual(['POST'])
  expect(requested).toEqual(['character-1'])
})
