import { afterEach, expect, it, vi } from 'vitest'
import type { SearchSnapshot } from '@dfragon/client-core/preload/common/types/search'
import { createBrowserCardSearch, createBrowserSearchRuntime } from './browser-search'

// 같은 origin 빌드의 API 주소처럼 경로가 붙은 base도 요청 주소에 그대로 남는지 본다.
const API_BASE_URL = 'https://site.example.test/api'
const identity = { serverId: 'cain', characterId: 'character-1' }
const metadata = {
  revision: 1,
  contentUpdatedAt: '2026-10-07T00:00:00.000Z',
  lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z'
}
const details = {
  character: { ...identity, characterName: '가나', serverName: '카인', level: 115 },
  status: { status: [], buff: null },
  equipment: { equipment: [], setItemInfo: [] },
  avatar: null,
  creature: null,
  oath: null,
  mistAssimilation: null,
  skillStyle: null,
  buff: { equipment: null, avatar: null, creature: null },
  sections: Object.fromEntries(
    [
      'basic',
      'status',
      'equipment',
      'avatar',
      'creature',
      'oath',
      'mist_assimilation',
      'skill_style',
      'buff_equipment',
      'buff_avatar',
      'buff_creature'
    ].map((section) => [section, metadata])
  ),
  freshness: {
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
    expiresAt: '2026-10-07T01:00:00.000Z'
  }
}

const candidate = {
  ...identity,
  characterName: '가나',
  serverName: '카인',
  fame: 71000,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/character-1?zoom=1'
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function requestUrls(fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>): string[] {
  return fetch.mock.calls.map((args) => new Request(...args).url)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('닉네임과 서버로 조회하면 API에서 상세를 받아 슬롯을 채우고, 명령 호출 중에는 동기적으로 알리지 않는다', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (...args) =>
    new URL(new Request(...args).url).pathname === '/api/characters/candidates'
      ? json({ rows: [candidate] })
      : json(details)
  )
  vi.stubGlobal('fetch', fetch)
  const search = createBrowserCardSearch('party', createBrowserSearchRuntime(API_BASE_URL, vi.fn()))
  const snapshots: SearchSnapshot[] = []
  search.onCharacterSearchChanged((snapshot) => snapshots.push(snapshot))
  const begun = await search.controlCharacterSearch({ action: 'begin' })
  const captureId = begun.snapshot.captureId!
  snapshots.length = 0

  const lookup = search.controlCharacterSearch({
    action: 'lookup',
    captureId,
    slot: 0,
    observationRevision: 1,
    nickname: '가나',
    serverId: 'cain'
  })
  expect(snapshots).toEqual([])
  await lookup
  await vi.waitFor(() =>
    expect(snapshots.at(-1)?.slots[0]).toMatchObject({ state: 'success', error: null })
  )

  expect(snapshots.at(-1)?.slots[0].selected).toMatchObject({
    ...identity,
    characterName: '가나',
    card: null
  })
  expect(requestUrls(fetch)).toEqual([
    `${API_BASE_URL}/characters/candidates?characterName=%EA%B0%80%EB%82%98`,
    `${API_BASE_URL}/characters/cain/character-1`
  ])
})

it('수동 조회의 검색과 상세 정보 오류 응답은 API가 보낸 message를 슬롯 오류에 담는다', async () => {
  let candidatesFound = false
  const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
    const candidates = new URL(new Request(...args).url).pathname === '/api/characters/candidates'
    if (candidates && candidatesFound) {
      return json({ rows: [candidate] })
    }

    if (candidates) {
      return json({ error: { code: 'NEOPLE_UNAVAILABLE', message: '검색 오류 문구' } }, 503)
    }

    return json({ error: { code: 'NEOPLE_TIMEOUT', message: '상세 오류 문구' } }, 504)
  })
  vi.stubGlobal('fetch', fetch)
  const search = createBrowserCardSearch('party', createBrowserSearchRuntime(API_BASE_URL, vi.fn()))
  const snapshots: SearchSnapshot[] = []
  search.onCharacterSearchChanged((snapshot) => snapshots.push(snapshot))
  const begun = await search.controlCharacterSearch({ action: 'begin' })
  const lookup = { action: 'lookup', captureId: begun.snapshot.captureId!, slot: 0 } as const

  await search.controlCharacterSearch({ ...lookup, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() =>
    expect(snapshots.at(-1)?.slots[0]).toMatchObject({
      state: 'failure',
      error: { code: 'NEOPLE_UNAVAILABLE', message: '검색 오류 문구' }
    })
  )

  candidatesFound = true
  await search.controlCharacterSearch({
    ...lookup,
    observationRevision: 2,
    nickname: '가나',
    serverId: 'cain'
  })
  await vi.waitFor(() =>
    expect(snapshots.at(-1)?.slots[0]).toMatchObject({
      state: 'failure',
      error: { code: 'NEOPLE_TIMEOUT', message: '상세 오류 문구' }
    })
  )
})

it('후보 초상화는 네오플 이미지 서버가 아니라 API의 초상화 전달 경로에서 받는다', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ error: { code: 'x' } }, 404))
  vi.stubGlobal('fetch', fetch)
  const { identification } = createBrowserSearchRuntime(API_BASE_URL, vi.fn())

  await expect(
    identification.image({ ...identity, signal: new AbortController().signal })
  ).rejects.toMatchObject({ code: 'NEOPLE_API_ERROR' })
  expect(requestUrls(fetch)).toEqual([`${API_BASE_URL}/characters/cain/character-1/image`])
})

it('형식이 맞지 않는 명령은 API를 부르지 않고 INVALID_SEARCH_COMMAND로 답한다', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)
  const search = createBrowserCardSearch('raid', createBrowserSearchRuntime(API_BASE_URL, vi.fn()))

  const result = await search.controlCharacterSearch({
    action: 'lookup',
    captureId: crypto.randomUUID(),
    slot: 12,
    observationRevision: 1,
    nickname: '가나',
    serverId: 'cain'
  })

  expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  expect(fetch).not.toHaveBeenCalled()
})
