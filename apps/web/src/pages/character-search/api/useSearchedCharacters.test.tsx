// @vitest-environment jsdom
import { HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterSearchQuery, SearchedCharacter } from '#core/api'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { searchedCharacterRow } from './character-search.fixture'
import { CHARACTER_SEARCH_URL } from './character-search.handlers'
import { useSearchedCharacters } from './useSearchedCharacters'

const INVALID_RESPONSE_MESSAGE = '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<readonly SearchedCharacter[]>
let queries: Record<string, string>[]

function Harness({ query }: { query: CharacterSearchQuery }): null {
  const value = useSearchedCharacters(query)
  useEffect(() => {
    result = value
  })

  return null
}

beforeEach(() => {
  result = { status: 'loading' }
  queries = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function respond(reply: () => Response | Promise<Response>): void {
  server.use(
    http.get(CHARACTER_SEARCH_URL, ({ request }) => {
      const { searchParams } = new URL(request.url)
      queries.push(Object.fromEntries(searchParams))

      return reply()
    })
  )
}

function respondJson(body: JsonBodyType, status = 200): void {
  respond(() => HttpResponse.json(body, { status }))
}

async function settle(
  query: CharacterSearchQuery = { characterName: '가나', serverId: 'all' }
): Promise<LoadedResult<readonly SearchedCharacter[]>> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness query={query} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  return result
}

function errorMessage(read: LoadedResult<unknown>): string | undefined {
  if (read.status === 'error') {
    return read.message
  }

  return undefined
}

describe('이름으로 시작하는 캐릭터 검색', () => {
  it('이름, 서버와 200명 상한을 query로 보내고 받은 순서대로 행을 준다', async () => {
    respondJson({
      rows: [
        searchedCharacterRow({ serverId: 'cain', characterId: 'c-1' }),
        searchedCharacterRow({ serverId: 'cain', characterId: 'c-2' })
      ]
    })

    const read = await settle({ characterName: '가나', serverId: 'cain' })

    expect(read.status === 'success' && read.value.map((row) => row.characterId)).toEqual([
      'c-1',
      'c-2'
    ])
    expect(queries).toEqual([{ characterName: '가나', serverId: 'cain', limit: '200' }])
  })

  it('서버를 고른 검색에 다른 서버의 행이 오면 응답을 확인하지 못했다고 알린다', async () => {
    respondJson({
      rows: [
        searchedCharacterRow({ serverId: 'cain', characterId: 'c-1' }),
        searchedCharacterRow({ serverId: 'prey', characterId: 'p-1' })
      ]
    })

    expect(errorMessage(await settle({ characterName: '가나', serverId: 'cain' }))).toBe(
      INVALID_RESPONSE_MESSAGE
    )
  })

  it.each([
    ['열세 글자 이름', '가나다라마바사아자차카타파', 'all'],
    ['앞뒤 공백', ' 가나', 'all'],
    ['모르는 서버', '가나', 'unknown']
  ])('%s는 요청하지 않고 검색 조건을 확인하라고 알린다', async (_, characterName, serverId) => {
    respondJson({ rows: [] })

    expect(errorMessage(await settle({ characterName, serverId }))).toBe(
      '검색 조건을 확인해 주세요.'
    )
    expect(queries).toEqual([])
  })
})

// 문구는 API가 이 경로에 보내는 문구와 같게 둔다.
const API_ERRORS: [status: number, apiCode: string, message: string][] = [
  [400, 'INVALID_SEARCH_QUERY', '검색 조건을 확인해 주세요.'],
  [500, 'INTERNAL_SERVER_ERROR', '서버 오류로 검색을 처리하지 못했습니다.'],
  [502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
  [503, 'NEOPLE_UNAVAILABLE', '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'],
  [504, 'NEOPLE_TIMEOUT', '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.']
]

describe('검색 API 오류 응답', () => {
  it.each(API_ERRORS)('%i %s는 API 문구를 그대로 알린다', async (status, apiCode, message) => {
    respondJson({ error: { code: apiCode, message } }, status)

    expect(errorMessage(await settle())).toBe(message)
  })

  it('Swagger에 없는 404 CHARACTER_NOT_FOUND를 받으면 API 문구 대신 응답을 확인하지 못했다고 알린다', async () => {
    respondJson({ error: { code: 'CHARACTER_NOT_FOUND', message: 'API 문구' } }, 404)

    expect(errorMessage(await settle())).toBe(INVALID_RESPONSE_MESSAGE)
  })

  it('JSON이 아닌 502를 받으면 클라이언트 문구로 알린다', async () => {
    respond(() => new HttpResponse('error code: 502', { status: 502 }))

    expect(errorMessage(await settle())).toBe(INVALID_RESPONSE_MESSAGE)
  })
})
