import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createNeopleCharacterImage } from '../src/characters/image/neople.js'
import { createApiHttpApp } from '../src/http.js'
import type { FetchTransport } from '../src/types/neople-character-search.js'

const unusedProvider = async (): Promise<never> => {
  throw new Error('character image test must not call this provider')
}
// PNG signature 뒤에 합성 byte를 붙인 값이다. API는 본문을 해석하지 않고 그대로 전달한다.
const PNG_BYTES = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  Buffer.from('synthetic-portrait')
])
const IMAGE_PATH = '/characters/cain/character_id-1/image'
const NEOPLE_IMAGE_URL =
  'https://img-api.neople.co.kr/df/servers/cain/characters/character_id-1?zoom=1'

function pngResponse(body: BodyInit = PNG_BYTES, headers: HeadersInit = {}) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'image/png', ...headers } })
}

async function startApp(t: test.TestContext, transport: FetchTransport): Promise<string> {
  const app = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: { fetchDetails: unusedProvider, catalog: createCatalogService(unusedProvider) },
    todayGrade: { fetchShopGrade: unusedProvider },
    fetchCharacterImage: createNeopleCharacterImage({ fetch: transport }),
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')

  return app.getUrl()
}

test('초상화 전달은 검증한 식별자로 만든 Neople URL의 PNG를 key 없이 받아 그대로 보낸다', async (t) => {
  const requests: Request[] = []
  const origin = await startApp(t, async (request) => {
    requests.push(request)

    return pngResponse()
  })

  const response = await fetch(origin + IMAGE_PATH)

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.equal(response.headers.get('cache-control'), 'private, max-age=3600')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG_BYTES)
  assert.equal(requests.length, 1)
  assert.equal(requests[0]!.url, NEOPLE_IMAGE_URL)
  assert.equal(requests[0]!.method, 'GET')
  assert.equal(requests[0]!.headers.has('apikey'), false)
})

test('초상화 전달은 잘못된 식별자, query, HEAD를 Neople 호출 없이 400으로 거절한다', async (t) => {
  let calls = 0
  const origin = await startApp(t, async () => {
    calls += 1

    return pngResponse()
  })

  for (const [name, path, method] of [
    ['알 수 없는 서버', '/characters/unknown/character_id-1/image', 'GET'],
    ['허용하지 않는 문자', '/characters/cain/character.id/image', 'GET'],
    ['인코딩한 경로 구분자', '/characters/cain/character%2Fid/image', 'GET'],
    ['query', `${IMAGE_PATH}?zoom=3`, 'GET'],
    ['HEAD', IMAGE_PATH, 'HEAD']
  ] as const) {
    const response = await fetch(origin + path, { method })

    assert.equal(response.status, 400, name)
    assert.equal(response.headers.get('cache-control'), 'no-store', name)
    if (method === 'GET') {
      assert.deepEqual(await response.json(), {
        error: { code: 'INVALID_CHARACTER_QUERY', message: '캐릭터 조회 조건을 확인해 주세요.' }
      })
    }
  }
  assert.equal(calls, 0)
})

test('초상화 전달은 Neople 실패와 PNG가 아니거나 상한을 넘는 응답을 정제한 오류로 보낸다', async (t) => {
  let upstream: () => Promise<Response> = async () => pngResponse()
  const origin = await startApp(t, () => upstream())
  const oversized = Buffer.alloc(4 * 1024 * 1024 + 1)

  for (const { name, respond, status, code } of [
    {
      name: '이미지 서버 404',
      respond: async () => new Response('missing', { status: 404 }),
      status: 502,
      code: 'NEOPLE_API_ERROR'
    },
    {
      name: '이미지 서버 503',
      respond: async () => new Response('busy', { status: 503 }),
      status: 503,
      code: 'NEOPLE_UNAVAILABLE'
    },
    {
      name: 'PNG가 아닌 Content-Type',
      respond: async () => pngResponse('<html></html>', { 'Content-Type': 'text/html' }),
      status: 502,
      code: 'NEOPLE_API_ERROR'
    },
    {
      name: '4MiB를 넘는 본문',
      respond: async () => pngResponse(oversized),
      status: 502,
      code: 'NEOPLE_API_ERROR'
    },
    {
      name: '네트워크 오류',
      respond: async (): Promise<never> => {
        throw new TypeError('fetch failed')
      },
      status: 502,
      code: 'NEOPLE_API_ERROR'
    }
  ]) {
    upstream = respond
    const response = await fetch(origin + IMAGE_PATH)

    assert.equal(response.status, status, name)
    assert.equal(response.headers.get('cache-control'), 'no-store', name)
    const body = (await response.json()) as { error: { code: string } }
    assert.equal(body.error.code, code, name)
  }
})
