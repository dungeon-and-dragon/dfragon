import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createCatalogService } from '../src/application/character-catalog/service.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'
import type { SearchCharacters } from '../src/application/character-search/ports.js'

const compiledMainPath = fileURLToPath(new URL('../../dist/main.js', import.meta.url))
const apiRoot = fileURLToPath(new URL('../../', import.meta.url))

const unusedSearchCharacters: SearchCharacters = async () => {
  throw new Error('app lifecycle test must not search Neople characters')
}
const unusedProvider = async (): Promise<never> => {
  throw new Error('app lifecycle test must not call Neople')
}

test('createApiHttpApp은 listen 전에는 port를 열지 않고 close 뒤 port를 닫는다', async () => {
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unusedSearchCharacters },
    details: { fetchDetails: unusedProvider, catalog: createCatalogService(unusedProvider) },
    todayGrade: { fetchShopGrade: unusedProvider }
  })
  const server = app.getHttpServer()

  assert.equal(server.listening, false)
  try {
    await app.listen(0, '127.0.0.1')
    assert.equal(server.listening, true)
  } finally {
    await app.close()
  }
  assert.equal(server.listening, false)
})

test('handler 전에 연결이 끊긴 검색, 상세, 초상화, 오늘의 등급 요청은 공급자를 호출하지 않는다', {
  timeout: 5000
}, async (t) => {
  const paths = [
    '/characters?characterName=ab',
    '/characters/candidates?characterName=ab',
    '/characters/cain/fixture-character',
    '/characters/cain/fixture-character/image',
    '/items/today-grade'
  ]
  const providerCalls: string[] = []
  const recordCall = (provider: string) => async (): Promise<never> => {
    providerCalls.push(provider)
    throw new Error('disconnected request must not call Neople')
  }
  let handledCount = 0
  let markAllHandled!: () => void
  const allHandled = new Promise<void>((resolve) => {
    markAllHandled = resolve
  })
  const { app } = await createApiHttpApp({
    search: { searchCharacters: recordCall('search') },
    details: {
      fetchDetails: recordCall('details'),
      catalog: createCatalogService(recordCall('catalog'))
    },
    todayGrade: { fetchShopGrade: recordCall('todayGrade') },
    fetchCharacterImage: recordCall('image'),
    // 요청은 socket 종료로 먼저 실패한다. handler는 요청 event 안에서 시작하므로, 공급자 호출 여부는 socket이 닫혀 접근 로그가 남은 뒤에 확인한다.
    writeAccessLog: () => {
      handledCount += 1
      if (handledCount === paths.length) {
        markAllHandled()
      }
    }
  })
  t.after(() => app.close())
  // 클라이언트가 요청을 보낸 직후 연결을 끊어 handler보다 socket 종료가 먼저인 상황을 만든다.
  app.getHttpServer().prependListener('request', (request) => {
    request.socket.destroy()
  })
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  for (const path of paths) {
    await assert.rejects(fetch(`${origin}${path}`), path)
  }
  await allHandled

  assert.deepEqual(providerCalls, [])
})

function watchAbort() {
  let markCalled!: () => void
  const called = new Promise<void>((resolve) => {
    markCalled = resolve
  })
  let markAborted!: () => void
  const aborted = new Promise<void>((resolve) => {
    markAborted = resolve
  })
  const provider = (_identity: unknown, signal: AbortSignal): Promise<never> =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        markAborted()
        reject(signal.reason)
      })
      markCalled()
    })

  return { called, aborted, provider }
}

test('응답을 기다리던 클라이언트가 연결을 끊으면 진행 중인 상세, 초상화 공급자 호출을 취소한다', {
  timeout: 5000
}, async (t) => {
  const details = watchAbort()
  const image = watchAbort()
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unusedSearchCharacters },
    details: { fetchDetails: details.provider, catalog: createCatalogService(unusedProvider) },
    todayGrade: { fetchShopGrade: unusedProvider },
    fetchCharacterImage: image.provider,
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  for (const [path, { called, aborted }] of [
    ['/characters/cain/fixture-character', details],
    ['/characters/cain/fixture-character/image', image]
  ] as const) {
    const disconnect = new AbortController()
    const pending = fetch(`${origin}${path}`, { signal: disconnect.signal }).catch(() => undefined)
    await called
    disconnect.abort()
    await pending

    // 공급자가 받은 signal이 abort되지 않으면 이 test가 timeout으로 실패한다.
    await aborted
  }
})

test('compiled main은 잘못된 필수 설정을 거절하고 정제된 문구로 종료한다', async (t) => {
  // 실제 환경, credential은 상속하지 않고 합성 입력만 전달한다.
  const environment: NodeJS.ProcessEnv = {
    PORT: '3000',
    NEOPLE_API_KEY: 'synthetic-private-api-key'
  }
  const cases = [
    { name: 'PORT 누락', change: { PORT: undefined } },
    { name: 'PORT 빈 값', change: { PORT: '' } },
    { name: 'PORT 비십진 입력', change: { PORT: '30.00' } },
    { name: 'Neople key 누락', change: { NEOPLE_API_KEY: undefined } },
    { name: 'Neople key 빈 값', change: { NEOPLE_API_KEY: '' } },
    { name: 'Neople key 공백', change: { NEOPLE_API_KEY: ' \n' } },
    { name: 'TLS 파일 짝 누락', change: { LOCAL_HTTPS_CERT_FILE: '/missing/cert.pem' } },
    { name: '점수 엔진 상대 경로', change: { SCORE_LIBRARY_FILE: 'libdnfscore.so' } }
  ]
  for (const { name, change } of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        promisify(execFile)(process.execPath, [compiledMainPath], {
          cwd: apiRoot,
          env: { ...environment, ...change },
          timeout: 5000,
          killSignal: 'SIGKILL'
        }),
        {
          code: 1,
          signal: null,
          stdout: '',
          stderr: 'API failed to start\n'
        }
      )
    })
  }
})

async function findFreePort(): Promise<number> {
  const server = createServer().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  server.close()
  await once(server, 'close')

  return port
}

// 점수 worker를 띄운 main은 여기서 보지 않는다. 시작 중인 worker를 끝내면 Linux의 koffi가 Node를 abort시켜
// 결과가 시작 속도에 따라 갈린다(#1081 Merge Risk). worker 종료는 점수 엔진 테스트가 확인한다.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  const title = `compiled main은 listen 뒤 ${signal}를 받으면 앱을 닫고 exit code 0으로 끝난다`
  test(title, { timeout: 10_000 }, async (t) => {
    const port = await findFreePort()
    const child = spawn(process.execPath, [compiledMainPath], {
      cwd: apiRoot,
      // 실제 환경, credential은 상속하지 않고 합성 입력만 전달한다.
      env: { PORT: String(port), NEOPLE_API_KEY: 'synthetic-private-api-key' },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    t.after(() => child.kill('SIGKILL'))
    let stderr = ''
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    const exited = once(child, 'close')
    const healthUrl = `http://127.0.0.1:${port}/health`
    const isListening = (): Promise<boolean> =>
      fetch(healthUrl, { signal: t.signal }).then(
        (response) => response.ok,
        () => false
      )
    while (!(await isListening())) {
      const isRunning = child.exitCode === null && child.signalCode === null
      assert(isRunning, 'compiled main must keep running until it listens')
      await delay(50, undefined, { signal: t.signal })
    }

    child.kill(signal)

    assert.deepEqual(await exited, [0, null])
    assert.equal(stderr, '')
    await assert.rejects(fetch(healthUrl))
  })
}
