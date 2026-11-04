import assert from 'node:assert/strict'
import test from 'node:test'
import { NeopleRequestFailure, createNeopleClientForTest } from '@dfragon/neople'

// 합성 key다. 실제 Neople credential이 아니다.
const apiKey = 'synthetic-neople-key'
const signal = new AbortController().signal
const identity = { serverId: 'cain', characterId: 'a/b c' }

function recordingClient(body) {
  const requests = []
  const neople = createNeopleClientForTest(apiKey, {
    origin: 'http://neople.test',
    fetch: async (request) => {
      requests.push(request)

      return Response.json(body)
    }
  })

  return { neople, requests }
}

test('endpoint마다 고정 경로와 encode한 값, query로 한 번 부르고 key는 헤더로만 보낸다', async () => {
  const character = { ...identity, characterName: '이름', status: [], buff: null }
  const cases = [
    {
      call: (neople) =>
        neople.searchCharacters('ca/in', {
          characterName: '가 나+&',
          limit: 10,
          wordType: 'match'
        }),
      body: { rows: [] },
      url: 'http://neople.test/df/servers/ca%2Fin/characters?characterName=%EA%B0%80+%EB%82%98%2B%26&limit=10&wordType=match'
    },
    {
      call: (neople) => neople.character(identity, 'status', signal),
      body: character,
      url: 'http://neople.test/df/servers/cain/characters/a%2Fb%20c/status'
    },
    {
      call: (neople) => neople.characterTimeline(identity, { next: 'cursor' }),
      body: { timeline: { rows: [], next: null } },
      url: 'http://neople.test/df/servers/cain/characters/a%2Fb%20c/timeline?next=cursor'
    },
    {
      call: (neople) => neople.multiItems(['item-1', 'item-2'], signal),
      body: { rows: [] },
      url: 'http://neople.test/df/multi/items?itemIds=item-1%2Citem-2'
    },
    {
      call: (neople) => neople.itemShop('item/1', signal),
      body: { itemGradeValue: 42 },
      url: 'http://neople.test/df/items/item%2F1/shop'
    },
    {
      call: (neople) => neople.skill('job/1', 'skill 1', signal),
      body: { jobId: 'job/1', name: '스킬' },
      url: 'http://neople.test/df/skills/job%2F1/skill%201'
    }
  ]
  for (const { call, body, url } of cases) {
    const { neople, requests } = recordingClient(body)
    assert.deepEqual(await call(neople), body, url)
    assert.equal(requests.length, 1, url)
    assert.equal(requests[0].url, url)
    assert.equal(requests[0].headers.get('apikey'), apiKey, url)
    assert.equal(requests[0].redirect, 'error', url)
  }
})

test('실패 종류와 원인: 분류한 실패와 schema 불일치는 원인 없이, 파싱, 연결 실패는 원래 오류를 원인으로 던진다', async () => {
  const cases = [
    {
      name: '알려진 오류 code는 status보다 먼저 분류한다',
      respond: () => Response.json({ error: { code: 'API002' } }, { status: 400 }),
      kind: 'unavailable',
      cause: undefined
    },
    {
      name: '모르는 오류 code는 status로 분류한다',
      respond: () => Response.json({ error: { code: 'FUTURE' } }, { status: 429 }),
      kind: 'unavailable',
      cause: undefined
    },
    {
      name: '2xx라도 오류 body면 실패다',
      respond: () => Response.json({ error: { code: 'API003' } }),
      kind: 'internal',
      cause: undefined
    },
    {
      name: 'JSON이 아닌 503',
      respond: () => new Response('<html>', { status: 503 }),
      kind: 'unavailable',
      cause: 'SyntaxError'
    },
    {
      name: 'JSON이 아닌 200',
      respond: () => new Response('<html>'),
      kind: 'api',
      cause: 'SyntaxError'
    },
    {
      name: 'schema에 맞지 않는 응답',
      respond: () => Response.json({ itemGradeValue: 'sensitive upstream value' }),
      kind: 'api',
      cause: undefined
    },
    {
      name: '연결 실패',
      respond: () => {
        throw new TypeError('fetch failed')
      },
      kind: 'api',
      // ky가 fetch의 연결 오류를 NetworkError로 감싼다.
      cause: 'NetworkError'
    }
  ]
  for (const { name, respond, kind, cause } of cases) {
    let calls = 0
    const neople = createNeopleClientForTest(apiKey, {
      fetch: async () => {
        calls++

        return respond()
      }
    })
    await assert.rejects(neople.itemShop('item', signal), (error) => {
      assert(error instanceof NeopleRequestFailure, name)
      assert.equal(error.kind, kind, name)
      assert.equal(Object.hasOwn(error, 'cause'), cause !== undefined, name)
      assert.equal(error.cause?.name, cause, name)
      assert.equal(error.message.includes('sensitive'), false, name)

      return true
    })
    assert.equal(calls, 1, name)
  }
})
