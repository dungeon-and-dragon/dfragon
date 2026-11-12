import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/application/character-catalog/service.js'
import { EMPTY_CHARACTER_TIMELINE } from '../src/domain/character-timeline/project.js'
import type { ScoreWorker } from '../src/infrastructure/score/engine.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../src/runtime/api-app.js'

// 실제 라이브러리를 열지 않는다. worker는 테스트가 준 fake다.
const SYNTHETIC_LIBRARY_PATH = '/synthetic/libdnfscore.so'

function scoreWorker(terminate: () => Promise<void>): ScoreWorker {
  return { postMessage: () => undefined, on: () => undefined, terminate }
}

function timelineClosedBy(close: () => Promise<void>): ApiHttpAppOptions['timeline'] {
  return {
    sync: async () => undefined,
    backfillEnhancements: async () => undefined,
    backfillSeason: async () => assert.fail('옛 시즌 받기를 부르면 안 된다'),
    read: async () => EMPTY_CHARACTER_TIMELINE,
    readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
    close
  }
}

const unused = {
  search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
  todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
  writeAccessLog: () => undefined
} satisfies Partial<ApiHttpAppOptions>

const unusedDetails: ApiHttpAppOptions['details'] = {
  fetchDetails: async () => assert.fail('상세 조회를 부르면 안 된다'),
  catalog: createCatalogService(async () => new Map())
}

// 닫기가 진행 중인 조회를 기다리게 바뀌면 멈추지 않고 실패하도록 timeout을 둔다.
test('진행 중인 상세 조회가 있을 때 app을 닫으면 조회를 취소한 뒤 점수 worker를 멈추고, 그 뒤 DB 연결을 닫는다', {
  timeout: 10_000
}, async () => {
  const steps: string[] = []
  let markFetching!: () => void
  const fetching = new Promise<void>((resolve) => {
    markFetching = resolve
  })
  const { app } = await createApiHttpApp({
    ...unused,
    details: {
      fetchDetails: (_identity, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            steps.push('상세 조회 취소')
            reject(signal.reason)
          })
          markFetching()
        }),
      catalog: createCatalogService(async () => new Map())
    },
    scoreLibraryPath: SYNTHETIC_LIBRARY_PATH,
    spawnScoreWorker: () =>
      scoreWorker(async () => {
        steps.push('점수 worker 정지')
      }),
    timeline: timelineClosedBy(async () => {
      steps.push('DB 연결 닫기')
    })
  })
  await app.listen(0, '127.0.0.1')
  const response = fetch(`${await app.getUrl()}/characters/cain/close-fixture`)
  await fetching

  await app.close()

  assert.deepEqual(steps, ['상세 조회 취소', '점수 worker 정지', 'DB 연결 닫기'])
  assert.equal((await response).status, 500)
  assert.equal(app.getHttpServer().listening, false)
})

test('닫기의 한 단계가 실패해도 뒤 단계를 실행하고 닫기는 실패를 알린다', async () => {
  let databaseClosed = 0
  const { app } = await createApiHttpApp({
    ...unused,
    details: unusedDetails,
    scoreLibraryPath: SYNTHETIC_LIBRARY_PATH,
    spawnScoreWorker: () =>
      scoreWorker(async () => {
        throw new Error('synthetic worker failure')
      }),
    timeline: timelineClosedBy(async () => {
      databaseClosed++
    })
  })
  await app.listen(0, '127.0.0.1')

  await assert.rejects(app.close(), AggregateError)

  assert.equal(databaseClosed, 1)
  assert.equal(app.getHttpServer().listening, false)
})

test('server를 만들지 못하면 이미 띄운 점수 worker를 멈추고 DB 연결을 닫는다', async () => {
  const steps: string[] = []

  await assert.rejects(
    createApiHttpApp({
      ...unused,
      details: unusedDetails,
      // 합성 값이며 실제 인증서가 아니다. PEM이 아니라서 HTTPS server를 만들지 못한다.
      httpsOptions: { cert: Buffer.from('synthetic'), key: Buffer.from('synthetic') },
      scoreLibraryPath: SYNTHETIC_LIBRARY_PATH,
      spawnScoreWorker: () =>
        scoreWorker(async () => {
          steps.push('점수 worker 정지')
        }),
      timeline: timelineClosedBy(async () => {
        steps.push('DB 연결 닫기')
      })
    })
  )

  assert.deepEqual(steps, ['점수 worker 정지', 'DB 연결 닫기'])
})
