import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  finishContentClearCollection,
  readContentClearCollection,
  readDatabaseConfiguration,
  recordContentClearCollectionProgress,
  startContentClearCollection
} from '@dfragon/database'
import { DatabaseClearStatsRepository } from '@dfragon/server-core/infrastructure/database/clear-stats.js'
import { ClearStatsService } from './dist/application/content-clears/service.js'

const at = (time) => new Date(`${time}+09:00`)

class ComputingRepository extends DatabaseClearStatsRepository {
  async readContentWeekSamples() {
    return null
  }

  async readOverviewSamples() {
    return null
  }
}

class StoredSampleRepository extends DatabaseClearStatsRepository {
  async readContentJobFames() {
    assert.fail('저장한 주를 다시 계산하면 안 된다')
  }

  async readFames() {
    assert.fail('저장한 주를 다시 계산하면 안 된다')
  }
}

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  // 앞 단계의 worker가 마감한 주마다 저장한 재료로 만든 상세와 전체 개요는 직접 계산한 값과 같다.
  const ignoreRefreshFailure = () => {}
  const computed = new ClearStatsService(new ComputingRepository(client), ignoreRefreshFailure)
  const stored = new ClearStatsService(new StoredSampleRepository(client), ignoreRefreshFailure)
  assert.deepEqual(
    await stored.contentStats('michaela-hard', '2026-11-05'),
    await computed.contentStats('michaela-hard', '2026-11-05')
  )
  assert.deepEqual(await stored.overview('2026-11-05'), await computed.overview('2026-11-05'))

  // 수집 진행 위치는 끝나기 전까지만 남는다.
  const collectionStartedAt = at('2026-11-10T06:00:00')
  assert.equal(await readContentClearCollection(client), undefined)
  await startContentClearCollection(client, collectionStartedAt)
  await recordContentClearCollectionProgress(client, { startedAt: collectionStartedAt, done: 300 })
  assert.deepEqual(await readContentClearCollection(client), {
    startedAt: collectionStartedAt,
    done: 300
  })
  await finishContentClearCollection(client, collectionStartedAt)
  assert.equal(await readContentClearCollection(client), undefined)
} finally {
  await client.$disconnect()
}
