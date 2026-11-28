import { expect, it } from 'vitest'
import { z } from 'zod'
import { createDfragonHttp } from './dfragon-http'
import { createJsonRequest } from './json-request'

function recordingRequest() {
  const caches: RequestCache[] = []
  const transport: typeof fetch = async (input) => {
    caches.push((input as Request).cache)

    return Response.json({ ok: true })
  }
  const requestJson = createJsonRequest(createDfragonHttp(transport), 'http://api.test')

  return { caches, requestJson }
}

const schema = z.object({ ok: z.boolean() })

it('cache를 주지 않은 요청은 HTTP 캐시를 쓰지 않고, 준 요청만 그 cache로 받는다', async () => {
  const { caches, requestJson } = recordingRequest()

  await requestJson('/plain', schema)
  await requestJson('/cached', schema, { cache: 'default' })

  expect(caches).toEqual(['no-store', 'default'])
})
