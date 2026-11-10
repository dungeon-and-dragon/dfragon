import assert from 'node:assert/strict'
import test from 'node:test'
import { NeopleRequestFailure, createNeopleClientForTest } from '@dfragon/neople'

// 합성 key다. 실제 Neople credential이 아니다.
const apiKey = 'synthetic-neople-key'
const signal = new AbortController().signal
const identity = { serverId: 'cain', characterId: 'a/b c' }
// 합성 캐릭터의 기본 정보다.
const basic = {
  ...identity,
  characterName: '이름',
  level: 115,
  jobId: 'job-1',
  jobGrowId: 'grow-1',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  fame: 60000,
  adventureName: '모험단',
  guildId: null,
  guildName: null
}

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
      call: (neople) => neople.characterBasic(identity),
      body: basic,
      url: 'http://neople.test/df/servers/cain/characters/a%2Fb%20c'
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

test('스킬 스타일은 /skill/style 경로로 부르고 저장할 모양으로 바꿔 돌려준다', async () => {
  const { neople, requests } = recordingClient({
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    skill: { style: { active: [{ skillId: 'skill-1', name: '합성 스킬', level: 13 }] } }
  })

  assert.deepEqual(await neople.characterSkillStyle(identity), {
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    skills: [{ name: '합성 스킬', level: 13 }],
    evolutions: [],
    enhancements: []
  })
  assert.equal(
    requests[0].url,
    'http://neople.test/df/servers/cain/characters/a%2Fb%20c/skill/style'
  )
})

test('기본 정보에 명성, 길드가 없으면 null로 돌려준다', async () => {
  const { fame: _fame, guildId: _guildId, guildName: _guildName, ...withoutGuild } = basic
  const { neople } = recordingClient(withoutGuild)

  assert.deepEqual(await neople.characterBasic(identity), {
    ...withoutGuild,
    fame: null,
    guildId: null,
    guildName: null
  })
})

test('기본 정보에 모험단 이름이 없으면 api 실패로 던진다', async () => {
  const { neople } = recordingClient({ ...basic, adventureName: null })

  await assert.rejects(neople.characterBasic(identity), (error) => {
    assert.ok(error instanceof NeopleRequestFailure)
    assert.equal(error.kind, 'api')

    return true
  })
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

test('DNF001은 없는 캐릭터로 표시하되 분류는 api로 두고 다른 오류 code는 표시하지 않는다', async () => {
  for (const [code, characterNotFound] of [
    ['DNF001', true],
    ['DNF003', false]
  ]) {
    const neople = createNeopleClientForTest(apiKey, {
      fetch: async () => Response.json({ error: { status: 404, code } }, { status: 404 })
    })
    await assert.rejects(neople.characterBasic(identity), (error) => {
      assert(error instanceof NeopleRequestFailure, code)
      assert.equal(error.kind, 'api', code)
      assert.equal(error.characterNotFound, characterNotFound, code)
      assert.equal(Object.hasOwn(error, 'cause'), false, code)

      return true
    })
  }
})

test('Neople 결과 코드표의 code는 HTTP status와 상관없이 코드표대로 분류한다', async () => {
  // 모르는 code는 429를 unavailable로 분류하므로, 429로 보내면 분류표에서 빠진 api code를 잡는다.
  const kinds = {
    internal: ['API000', 'API003', 'API004', 'API005'],
    unavailable: ['API002', 'API008', 'DNF980'],
    api: [
      'API001',
      'API006',
      'API007',
      'API900',
      'API901',
      'API999',
      'DNF000',
      'DNF001',
      'DNF003',
      'DNF004',
      'DNF005',
      'DNF006',
      'DNF007',
      'DNF008',
      'DNF009',
      'DNF900',
      'DNF901',
      'DNF999'
    ]
  }
  for (const [kind, codes] of Object.entries(kinds)) {
    for (const code of codes) {
      for (const status of [429, 200]) {
        const neople = createNeopleClientForTest(apiKey, {
          fetch: async () => Response.json({ error: { code } }, { status })
        })
        await assert.rejects(neople.itemShop('item', signal), (error) => {
          assert(error instanceof NeopleRequestFailure, code)
          assert.equal(error.kind, kind, `${code} ${status}`)

          return true
        })
      }
    }
  }
})
