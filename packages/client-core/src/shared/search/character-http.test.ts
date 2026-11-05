import { describe, expect, it, vi } from 'vitest'
import { createCharacterCandidatesHttp, createCharacterDetailsHttp } from './character-http'

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
