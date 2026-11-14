import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { Hono } from 'hono'
import {
  type AccessLogEnv,
  recordAccessLogCachedResponse,
  recordAccessLogNeopleStage,
  recordAccessLogSharedNeopleFetch
} from '../src/access-log.js'
import { createFailureHandler } from '../src/failure-response.js'
import { createHonoApp, createHonoAppHandle } from '../src/hono-app.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// 로컬에서 생성한 합성 self-signed fixture이며 배포, 인증에 사용하지 않는다. API의 runtime-configuration.test.ts와 같은 값이다.
const certificatePem = `-----BEGIN CERTIFICATE-----
MIIBfDCCASOgAwIBAgIUTaPGOpDSt/GNpqe2mIuH+SRZ2oUwCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MTAwMjE3MDEyMVoXDTM2MDkyOTE3
MDEyMVowFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEEf2pXtPgruXzVJkJH3LEn8Gjw79FnooFyOaCLPTG/7repqhmMsiAT8/w
7qDYpzShRJufniTuThvOl/rgugsK0aNTMFEwHQYDVR0OBBYEFOocbmvYUPDarg0W
tAttA7inijLFMB8GA1UdIwQYMBaAFOocbmvYUPDarg0WtAttA7inijLFMA8GA1Ud
EwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDRwAwRAIgQsQe22Bbkq9hxrqPtCpv2nmP
xd0YhIKteKAIzZ9wDxkCIFN5bQ0U9zkls9C0wsNNpGchsO3/6Gg2B0i4+c3JZiHM
-----END CERTIFICATE-----
`
const privateKeyPem = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQghnnmZX64Vmdk8B+M
IT8iFSoKKNx2FdL/9sw7dGivPgehRANCAAQR/ale0+Cu5fNUmQkfcsSfwaPDv0We
igXI5oIs9Mb/ut6mqGYyyIBPz/DuoNinNKFEm5+eJO5OG86X+uC6CwrR
-----END PRIVATE KEY-----
`

function collectAccessLogs() {
  const lines: string[] = []
  let notify: (() => void) | undefined
  const sink = (line: string): void => {
    lines.push(line)
    notify?.()
  }
  // 응답을 받은 뒤 서버의 close event가 늦게 올 수 있어 줄 수로 완료를 기다린다.
  const waitFor = async (count: number): Promise<void> => {
    while (lines.length < count) {
      await new Promise<void>((resolve) => {
        notify = resolve
      })
    }
  }

  return { lines, sink, waitFor }
}

function readFields(line: string) {
  const { time, durationMs, correlationId, ...fields } = JSON.parse(line) as Record<string, unknown>
  assert.equal(typeof time, 'string')
  assert(Number.isInteger(durationMs))
  assert.match(correlationId as string, UUID_PATTERN)

  return fields
}

function testApp(writeAccessLog: (line: string) => void = () => undefined) {
  return createHonoApp({
    accessLogService: 'test',
    writeAccessLog,
    toFailureResponse: () => ({ status: 500, body: { error: { code: 'COMMON_FAILURE' } } })
  })
}

async function listen(t: test.TestContext, app: Hono<AccessLogEnv>) {
  const handle = createHonoAppHandle(app)
  t.after(() => handle.close())
  await handle.listen(0, '127.0.0.1')

  return handle.getUrl()
}

test('요청 중에 기록한 Neople 단계별 시간, 합류, 캐시 여부가 그 요청의 접근 로그 한 줄에만 붙는다', {
  timeout: 5000
}, async (t) => {
  const logs = collectAccessLogs()
  const app = testApp(logs.sink)
  app.get('/details/:id', (c) => {
    recordAccessLogNeopleStage(c, 'basic', 12)
    recordAccessLogNeopleStage(c, 'sections', 34)

    return c.json({ id: c.req.param('id') })
  })
  app.get('/candidates', (c) => {
    recordAccessLogSharedNeopleFetch(c)
    recordAccessLogCachedResponse(c)

    return c.json({ rows: [] })
  })
  const origin = await listen(t, app)

  for (const [count, path] of [
    [1, '/details/fixture'],
    [2, '/candidates'],
    [3, '/details/other']
  ] as const) {
    assert.equal((await fetch(origin + path)).status, 200)
    await logs.waitFor(count)
  }

  const neopleMs = { basic: 12, sections: 34 }
  assert.deepEqual(logs.lines.map(readFields), [
    { service: 'test', method: 'GET', route: '/details/:id', status: 200, neopleMs },
    {
      service: 'test',
      method: 'GET',
      route: '/candidates',
      status: 200,
      neopleShared: true,
      responseCached: true
    },
    { service: 'test', method: 'GET', route: '/details/:id', status: 200, neopleMs }
  ])
})

test('route 묶음에 따로 둔 실패 표가 그 묶음의 실패에만 쓰이고 오류 code가 접근 로그에 남는다', {
  timeout: 5000
}, async (t) => {
  const logs = collectAccessLogs()
  const app = testApp(logs.sink)
  const feature = new Hono<AccessLogEnv>()
  feature.onError(
    createFailureHandler(() => ({
      status: 502,
      body: { error: { code: 'FEATURE_FAILURE', message: '기능 실패' } }
    }))
  )
  feature.get('/:id', () => {
    throw new Error('feature')
  })
  app.route('/feature', feature)
  app.get('/other', () => {
    throw new Error('other')
  })
  const origin = await listen(t, app)

  const featureResponse = await fetch(`${origin}/feature/fixture`)
  const otherResponse = await fetch(`${origin}/other`)
  await logs.waitFor(2)

  assert.deepEqual(
    [featureResponse.status, await featureResponse.json()],
    [502, { error: { code: 'FEATURE_FAILURE', message: '기능 실패' } }]
  )
  assert.deepEqual(
    [otherResponse.status, await otherResponse.json()],
    [500, { error: { code: 'COMMON_FAILURE' } }]
  )
  assert.deepEqual(
    logs.lines.map((line) => {
      const { route, status, code } = readFields(line)

      return { route, status, code }
    }),
    [
      { route: '/feature/:id', status: 502, code: 'FEATURE_FAILURE' },
      { route: '/other', status: 500, code: 'COMMON_FAILURE' }
    ]
  )
})

test('handler가 직접 만든 Response에도 Cache-Control과 X-Correlation-Id를 붙이고, handler가 정한 Content-Type과 Cache-Control은 바꾸지 않는다', async (t) => {
  const app = testApp()
  const image = new Uint8Array([137, 80, 78, 71])
  app.get('/image', () => new Response(image, { headers: { 'Content-Type': 'image/png' } }))
  app.get('/cached-image', (c) =>
    c.body(image, 200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' })
  )
  const origin = await listen(t, app)

  const response = await fetch(`${origin}/image`)
  const cached = await fetch(`${origin}/cached-image`)

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('x-correlation-id') ?? '', UUID_PATTERN)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), image)
  assert.equal(cached.headers.get('content-type'), 'image/png')
  assert.equal(cached.headers.get('cache-control'), 'private, max-age=3600')
  assert.match(cached.headers.get('x-correlation-id') ?? '', UUID_PATTERN)
})

test('handler는 요청 URL에서 디코딩하지 않은 원문 query 문자열을 읽는다', async (t) => {
  const app = testApp()
  app.get('/search', (c) => c.text(new URL(c.req.url).search))
  const origin = await listen(t, app)
  const query = '?characterName=%EA%B0%80%2B&wordType=full&wordType=match&empty='

  const response = await fetch(`${origin}/search${query}`)

  assert.equal(await response.text(), query)
})

test('응답을 보내기 전에 클라이언트 연결이 끊기면 요청의 signal이 abort된다', {
  timeout: 5000
}, async (t) => {
  const app = testApp()
  let markEntered!: () => void
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve
  })
  let markAborted!: () => void
  const aborted = new Promise<void>((resolve) => {
    markAborted = resolve
  })
  app.get('/slow', async (c) => {
    const { signal } = c.req.raw
    signal.addEventListener('abort', markAborted, { once: true })
    markEntered()
    await aborted

    return c.body(null, 204)
  })
  const origin = await listen(t, app)
  const disconnect = new AbortController()

  const pending = fetch(`${origin}/slow`, { signal: disconnect.signal }).catch(() => undefined)
  await entered
  disconnect.abort()
  await pending

  // signal이 abort되지 않으면 handler가 끝나지 않아 이 test가 timeout으로 실패한다.
  await aborted
})

test('HTTPS 옵션을 주면 그 인증서로 TLS 연결을 받고 https URL을 준다', async (t) => {
  const app = testApp()
  app.get('/ping', (c) => c.json({ pong: true }))
  const handle = createHonoAppHandle(app, {
    httpsOptions: { cert: Buffer.from(certificatePem), key: Buffer.from(privateKeyPem) }
  })
  t.after(() => handle.close())
  await handle.listen(0, '127.0.0.1')
  const url = await handle.getUrl()

  // 인증서 이름은 localhost라 IP로 접속하는 이 요청에서는 이름 검사만 건너뛰고, 서명은 fixture 인증서로 검증한다.
  const request = httpsRequest(`${url}/ping`, {
    ca: certificatePem,
    checkServerIdentity: () => undefined
  })
  request.end()
  const [response] = await once(request, 'response')
  response.resume()
  await once(response, 'end')

  assert.match(url, /^https:\/\/127\.0\.0\.1:\d+$/)
  assert.equal(response.statusCode, 200)
})

test('이미 쓰는 port에 listen하면 reject하고, 그 뒤에 닫아도 close 함수를 부르고 끝난다', async (t) => {
  const occupied = createServer().listen(0, '127.0.0.1')
  await once(occupied, 'listening')
  t.after(() => occupied.close())
  const { port } = occupied.address() as AddressInfo
  let closeCount = 0
  const handle = createHonoAppHandle(testApp(), {
    close: async (closeServer) => {
      await closeServer()
      closeCount += 1
    }
  })

  await assert.rejects(handle.listen(port, '127.0.0.1'), { code: 'EADDRINUSE' })
  await handle.close()

  assert.equal(closeCount, 1)
})
