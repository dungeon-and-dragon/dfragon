import assert from 'node:assert/strict'
import { test } from 'node:test'
import { neopleCharacterImageUrl } from '@dfragon/neople'
import { createCharacterSearchService } from '../dist/application/character-search/service.js'
import { parseCharacterSearchQuery } from '../dist/domain/character-search/query.js'
import { characterSearchFailureResponse } from '../dist/presentation/http/character-search/failures.js'

const input = parseCharacterSearchQuery('/characters?characterName=ab')

function fixture(overrides = {}) {
  const calls = []
  const service = createCharacterSearchService({
    searchCharacters: async (input) => {
      calls.push(input)

      return { rows: [] }
    },
    characterImageUrl: neopleCharacterImageUrl,
    ...overrides
  })

  return { service, calls }
}

test('동시 검색 열두 건을 IP별 한도 없이 모두 공급자에 보낸다', async () => {
  const f = fixture()
  try {
    const results = await Promise.all(Array.from({ length: 12 }, () => f.service.search(input)))
    for (const result of results) {
      assert.deepEqual(result, { rows: [] })
    }
    assert.equal(f.calls.length, 12)
  } finally {
    await f.service.close()
  }
})

test('종료 후 검색은 공급자를 호출하지 않는다', async () => {
  const f = fixture()
  await f.service.close()
  await assert.rejects(f.service.search(input), { name: 'NeopleSearchFailure', kind: 'internal' })
  assert.equal(f.calls.length, 0)
})

test('공급자의 미분류 실패는 내부 오류로 정제하고 이후 검색을 막지 않는다', async () => {
  let calls = 0
  const f = fixture({
    searchCharacters: async () => {
      calls++
      throw new Error('private detail')
    }
  })
  try {
    for (let index = 0; index < 11; index++) {
      await assert.rejects(f.service.search(input), (error) => {
        assert.equal(error.name, 'NeopleSearchFailure')
        const response = characterSearchFailureResponse(error)
        assert.equal(response.status, 500)
        assert.deepEqual(response.body, {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '서버 오류로 검색을 처리하지 못했습니다.'
          }
        })

        return true
      })
    }
    assert.equal(calls, 11)
  } finally {
    await f.service.close()
  }
})
