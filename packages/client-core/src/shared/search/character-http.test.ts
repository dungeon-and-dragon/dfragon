import { describe, expect, it, vi } from 'vitest'
import type { SearchErrorCode } from '../../preload/common/types/search'
import {
  createCharacterCandidatesHttp,
  createCharacterDetailsHttp,
  createCharacterDetailViewHttp
} from './character-http'

const API_ORIGIN = 'https://api.example.test'
const NOT_FOUND_MESSAGE = 'API가 보낸 없는 캐릭터 문구'

function respondWith(body: unknown, status: number) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify(body), { status })
  )

  return { apiOrigin: API_ORIGIN, fetch }
}

function readDetails(body: unknown, status: number) {
  return createCharacterDetailsHttp(respondWith(body, status))({
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
    const candidates = createCharacterCandidatesHttp(
      respondWith({ error: { code: 'CHARACTER_NOT_FOUND', message: NOT_FOUND_MESSAGE } }, 404)
    )

    await expect(
      candidates({ nickname: '가나', signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
  })
})

type Route = 'candidates' | 'details' | 'detail-view'

function request(route: Route, response: Response): Promise<unknown> {
  const options = {
    apiOrigin: API_ORIGIN,
    fetch: vi.fn<typeof globalThis.fetch>(async () => response)
  }
  const signal = new AbortController().signal
  const identity = { serverId: 'cain', characterId: 'character-1' }
  switch (route) {
    case 'candidates':
      return createCharacterCandidatesHttp(options)({ nickname: '가나', signal })
    case 'details':
      return createCharacterDetailsHttp(options)({ ...identity, signal })
    case 'detail-view':
      return createCharacterDetailViewHttp(options)(identity)
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

  it.each(['candidates', 'details', 'detail-view'] as const)(
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
