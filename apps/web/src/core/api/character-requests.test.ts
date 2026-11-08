import { describe, expect, it, vi } from 'vitest'
import { CHARACTER_SERVER_NAMES } from '../character/character-summary'
import type { SearchErrorCode } from '../search/search'
import { createDfragonClient } from './dfragon-client'

const API_ORIGIN = 'https://api.example.test'
const NOT_FOUND_MESSAGE = 'API가 보낸 없는 캐릭터 문구'

function respondWith(body: unknown, status: number) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify(body), { status })
  )

  return { apiOrigin: API_ORIGIN, fetch }
}

function readDetails(body: unknown, status: number) {
  return createDfragonClient(respondWith(body, status)).characters.details({
    serverId: 'cain',
    characterId: 'missing-character',
    signal: new AbortController().signal
  })
}

describe('없는 캐릭터의 404 응답', () => {
  it('상세 조회는 404 CHARACTER_NOT_FOUND의 error.message를 오류 문구로 준다', async () => {
    await expect(
      readDetails({ error: { code: 'CHARACTER_NOT_FOUND', message: NOT_FOUND_MESSAGE } }, 404)
    ).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND', message: NOT_FOUND_MESSAGE })
  })

  it('상세 조회도 404에 CHARACTER_NOT_FOUND가 아닌 code가 오면 SEARCH_RESPONSE_INVALID로 실패한다', async () => {
    await expect(
      readDetails({ error: { code: 'NEOPLE_API_ERROR', message: '다른 문구' } }, 404)
    ).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
  })

  it('후보 검색은 404 CHARACTER_NOT_FOUND를 받아도 SEARCH_RESPONSE_INVALID로 실패한다', async () => {
    const candidates = createDfragonClient(
      respondWith({ error: { code: 'CHARACTER_NOT_FOUND', message: NOT_FOUND_MESSAGE } }, 404)
    ).characters.candidates

    await expect(
      candidates({ nickname: '가나', signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
  })
})

type Route = 'candidates' | 'search' | 'details' | 'detail-view'

function request(route: Route, response: Response): Promise<unknown> {
  const options = {
    apiOrigin: API_ORIGIN,
    fetch: vi.fn<typeof globalThis.fetch>(async () => response)
  }
  const signal = new AbortController().signal
  const identity = { serverId: 'cain', characterId: 'character-1' }
  switch (route) {
    case 'candidates':
      return createDfragonClient(options).characters.candidates({ nickname: '가나', signal })
    case 'search':
      return createDfragonClient(options).characters.search({
        characterName: '가나',
        serverId: 'all'
      })
    case 'details':
      return createDfragonClient(options).characters.details({ ...identity, signal })
    case 'detail-view':
      return createDfragonClient(options).characters.detailView(identity)
  }
}

function apiError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), { status })
}

type ApiErrorCase = [status: number, apiCode: string, code: SearchErrorCode, message: string]

// 문구는 API가 경로마다 보내는 문구와 같게 둔다.
// 상세 경로의 404 CHARACTER_NOT_FOUND는 위 describe와 character-detail-view.test.ts가 확인한다.
const candidateErrors: ApiErrorCase[] = [
  [400, 'INVALID_SEARCH_QUERY', 'INVALID_SEARCH_QUERY', '검색 조건을 확인해 주세요.'],
  [
    500,
    'INTERNAL_SERVER_ERROR',
    'INTERNAL_SERVER_ERROR',
    '서버 오류로 검색을 처리하지 못했습니다.'
  ],
  [502, 'NEOPLE_API_ERROR', 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
  [
    503,
    'NEOPLE_UNAVAILABLE',
    'NEOPLE_UNAVAILABLE',
    '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  ],
  [
    504,
    'NEOPLE_TIMEOUT',
    'NEOPLE_TIMEOUT',
    '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
  ]
]
const detailErrors: ApiErrorCase[] = [
  [400, 'INVALID_CHARACTER_QUERY', 'INVALID_SEARCH_QUERY', '캐릭터 조회 조건을 확인해 주세요.'],
  [
    500,
    'INTERNAL_SERVER_ERROR',
    'INTERNAL_SERVER_ERROR',
    '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'
  ],
  [502, 'NEOPLE_API_ERROR', 'NEOPLE_API_ERROR', '캐릭터 정보 조회 중 오류가 발생했습니다.'],
  [
    503,
    'NEOPLE_UNAVAILABLE',
    'NEOPLE_UNAVAILABLE',
    '현재 캐릭터 정보를 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  ],
  [
    504,
    'NEOPLE_TIMEOUT',
    'NEOPLE_TIMEOUT',
    '캐릭터 정보 조회 시간이 초과됐습니다. 다시 시도해 주세요.'
  ]
]
const cases: [Route, ...ApiErrorCase][] = [
  ...candidateErrors.map((error): [Route, ...ApiErrorCase] => ['candidates', ...error]),
  ...candidateErrors.map((error): [Route, ...ApiErrorCase] => ['search', ...error]),
  ...detailErrors.map((error): [Route, ...ApiErrorCase] => ['details', ...error]),
  ...detailErrors.map((error): [Route, ...ApiErrorCase] => ['detail-view', ...error])
]

describe('경로별 API 오류 응답', () => {
  it.each(cases)(
    '%s의 %i %s는 %s로 실패하고 API 문구를 그대로 준다',
    async (route, status, apiCode, code, message) => {
      await expect(request(route, apiError(status, apiCode, message))).rejects.toMatchObject({
        code,
        message,
        serverMessage: message
      })
    }
  )

  it.each([
    ['candidates', 400, 'INVALID_CHARACTER_QUERY'],
    ['search', 404, 'CHARACTER_NOT_FOUND'],
    ['details', 400, 'INVALID_SEARCH_QUERY'],
    ['detail-view', 404, 'NEOPLE_API_ERROR'],
    ['detail-view', 409, 'CHARACTER_NOT_FOUND']
  ] as const)(
    '%s가 Swagger에 없는 %i %s를 받으면 SEARCH_RESPONSE_INVALID로 실패한다',
    async (route, status, apiCode) => {
      await expect(request(route, apiError(status, apiCode, '문구'))).rejects.toMatchObject({
        code: 'SEARCH_RESPONSE_INVALID',
        serverMessage: undefined
      })
    }
  )

  it.each(['candidates', 'search', 'details', 'detail-view'] as const)(
    '%s가 JSON이 아닌 502를 받으면 클라이언트 문구로 실패한다',
    async (route) => {
      await expect(
        request(route, new Response('error code: 502', { status: 502 }))
      ).rejects.toMatchObject({
        code: 'SEARCH_RESPONSE_INVALID',
        message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
      })
    }
  )
})

function searchRow(serverId: 'cain' | 'prey', characterId: string) {
  return {
    serverId,
    characterId,
    characterName: '가나다',
    serverName: CHARACTER_SERVER_NAMES[serverId],
    fame: null,
    jobName: null,
    jobGrowName: null,
    imageUrl: `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${characterId}?zoom=1`
  }
}

describe('이름으로 시작하는 캐릭터 검색', () => {
  it('이름, 서버와 200명 상한을 query로 보내고 받은 순서대로 행을 준다', async () => {
    const options = respondWith({ rows: [searchRow('cain', 'c-1'), searchRow('cain', 'c-2')] }, 200)

    const rows = await createDfragonClient(options).characters.search({
      characterName: '가나',
      serverId: 'cain'
    })

    expect(rows.map((row) => row.characterId)).toEqual(['c-1', 'c-2'])
    const url = new URL(new Request(...options.fetch.mock.calls[0]).url)
    expect(`${url.origin}${url.pathname}`).toBe(`${API_ORIGIN}/characters`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      characterName: '가나',
      serverId: 'cain',
      limit: '200'
    })
  })

  it('서버를 고른 검색에 다른 서버의 행이 오면 SEARCH_RESPONSE_INVALID로 실패한다', async () => {
    const search = createDfragonClient(
      respondWith({ rows: [searchRow('cain', 'c-1'), searchRow('prey', 'p-1')] }, 200)
    ).characters.search

    await expect(search({ characterName: '가나', serverId: 'cain' })).rejects.toMatchObject({
      code: 'SEARCH_RESPONSE_INVALID'
    })
  })

  it.each([
    ['열세 글자 이름', '가나다라마바사아자차카타파', 'all'],
    ['앞뒤 공백', ' 가나', 'all'],
    ['모르는 서버', '가나', 'unknown']
  ])('%s는 요청하지 않고 INVALID_SEARCH_QUERY로 실패한다', async (_, characterName, serverId) => {
    const options = respondWith({ rows: [] }, 200)

    await expect(
      createDfragonClient(options).characters.search({ characterName, serverId })
    ).rejects.toMatchObject({ code: 'INVALID_SEARCH_QUERY' })
    expect(options.fetch).not.toHaveBeenCalled()
  })
})

describe('캐릭터 이미지 요청', () => {
  const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

  function readImage(response: Response) {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response)
    const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).characters.image({
      serverId: 'cain',
      characterId: 'character-1',
      signal: new AbortController().signal
    })

    return { fetch, read }
  }

  it('API 이미지 경로에서 받은 PNG bytes를 풀지 않고 그대로 준다', async () => {
    const { fetch, read } = readImage(
      new Response(PNG_BYTES.slice(), { headers: { 'Content-Type': 'image/png; charset=binary' } })
    )

    await expect(read).resolves.toEqual(PNG_BYTES)
    expect(new Request(fetch.mock.calls[0][0]).url).toBe(
      `${API_ORIGIN}/characters/cain/character-1/image`
    )
  })

  it('Content-Type이 image/png가 아니면 SEARCH_RESPONSE_INVALID로 실패한다', async () => {
    const { read } = readImage(
      new Response(PNG_BYTES.slice(), { headers: { 'Content-Type': 'image/jpeg' } })
    )

    await expect(read).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
  })

  it.each([
    [429, 'SEARCH_RATE_LIMITED'],
    [502, 'NEOPLE_API_ERROR']
  ])('%i 응답은 %s로 실패한다', async (status, code) => {
    await expect(readImage(new Response(null, { status })).read).rejects.toMatchObject({ code })
  })
})
