import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type { TimelineQueueCount } from '@dfragon/database'
import { CatalogService } from '../src/application/character-catalog/service.js'
import { startQueueCountsWriter } from '../src/application/character-timeline/queue-counts.js'
import { createSeasonBackfillQueue } from '../src/application/character-timeline/season-backfill.js'
import type { CharacterIdentity } from '../src/domain/character-identity.js'
import type { CharacterPayloads } from '../src/domain/character-detail/sections.js'
import { EMPTY_CHARACTER_TIMELINE } from '../src/domain/character-timeline/project.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

// 주기를 1ms로 줄이고, queue 수를 읽은 횟수로 주기가 지났는지 기다린다.
const INTERVAL_MS = 1

function countsSource(initial: readonly TimelineQueueCount[]) {
  let counts = initial
  let reads = 0
  let notify: (() => void) | undefined

  return {
    read: () => {
      reads += 1
      notify?.()

      return counts
    },
    set: (next: readonly TimelineQueueCount[]) => {
      counts = next
    },
    reads: () => reads,
    waitReads: async (count: number) => {
      const target = reads + count

      while (reads < target) {
        await new Promise<void>((resolve) => {
          notify = resolve
        })
      }
    }
  }
}

function recordingWrite() {
  const writes: (readonly TimelineQueueCount[])[] = []

  return {
    writes,
    write: async (counts: readonly TimelineQueueCount[]) => {
      writes.push(counts)
    }
  }
}

const idle = (name: string): TimelineQueueCount => ({ name, waiting: 0, running: 0 })
const unexpectedFailure = () => assert.fail('쓰기 실패가 보고되면 안 된다')

test('queue 수 쓰기는 시작할 때 모든 queue를 쓰고, 그 뒤에는 수가 바뀐 queue만 쓰며 바뀌지 않는 동안에는 쓰지 않는다', async (t) => {
  const source = countsSource([idle('timeline-sync'), idle('season-backfill')])
  const { writes, write } = recordingWrite()
  const writer = startQueueCountsWriter(source.read, write, unexpectedFailure, INTERVAL_MS)
  t.after(() => writer.stop())

  await source.waitReads(3)
  assert.deepEqual(writes, [[idle('timeline-sync'), idle('season-backfill')]])

  source.set([{ name: 'timeline-sync', waiting: 2, running: 1 }, idle('season-backfill')])
  await source.waitReads(3)

  assert.deepEqual(writes, [
    [idle('timeline-sync'), idle('season-backfill')],
    [{ name: 'timeline-sync', waiting: 2, running: 1 }]
  ])
})

test('쓰기가 실패하면 실패를 보고하고 다음 주기에 같은 수를 다시 쓴다', async (t) => {
  const source = countsSource([idle('timeline-sync')])
  const attempts: (readonly TimelineQueueCount[])[] = []
  let failures = 0
  const writer = startQueueCountsWriter(
    source.read,
    async (counts) => {
      attempts.push(counts)

      if (attempts.length === 1) {
        throw new Error('synthetic write failure')
      }
    },
    () => {
      failures += 1
    },
    INTERVAL_MS
  )
  t.after(() => writer.stop())

  await source.waitReads(4)

  assert.equal(failures, 1)
  assert.deepEqual(attempts, [[idle('timeline-sync')], [idle('timeline-sync')]])
})

test('앞 쓰기가 끝나지 않은 동안의 주기는 건너뛰고, 쓰기가 끝난 뒤 다음 주기에 그 사이 바뀐 수를 쓴다', async (t) => {
  const source = countsSource([idle('timeline-sync')])
  let releaseWrite!: () => void
  const writeBlocked = new Promise<void>((resolve) => {
    releaseWrite = resolve
  })

  const writes: (readonly TimelineQueueCount[])[] = []
  const writer = startQueueCountsWriter(
    source.read,
    async (counts) => {
      writes.push(counts)
      if (writes.length === 1) {
        await writeBlocked
      }
    },
    unexpectedFailure,
    INTERVAL_MS
  )
  t.after(() => writer.stop())

  const running = { name: 'timeline-sync', waiting: 0, running: 1 }
  source.set([running])
  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.deepEqual([writes.length, source.reads()], [1, 1])

  releaseWrite()
  await source.waitReads(2)

  assert.deepEqual(writes, [[idle('timeline-sync')], [running]])
})

test('멈추면 진행 중인 쓰기가 끝난 뒤에 끝나고, 그 뒤에는 queue 수를 읽거나 쓰지 않는다', async () => {
  const source = countsSource([idle('timeline-sync')])
  let releaseWrite!: () => void
  const writeBlocked = new Promise<void>((resolve) => {
    releaseWrite = resolve
  })

  let writes = 0
  const writer = startQueueCountsWriter(
    source.read,
    async () => {
      writes += 1
      await writeBlocked
    },
    unexpectedFailure,
    INTERVAL_MS
  )

  let stopped = false
  const stopping = writer.stop().then(() => {
    stopped = true
  })

  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(stopped, false)

  releaseWrite()
  await stopping
  const readsAtStop = source.reads()
  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.equal(writes, 1)
  assert.equal(source.reads(), readsAtStop)
})

test('타임라인을 준 공개 app은 시작할 때 queue 3개의 수를 차례로 쓰고, 쓰기가 실패하면 code를 남기며 닫으면 다시 쓰지 않는다', async () => {
  const attempts: (readonly TimelineQueueCount[])[] = []
  const logs: string[] = []
  const unused = async () => assert.fail('queue 수 쓰기 테스트는 타임라인 일을 부르면 안 된다')
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: new CatalogService(async () => new Map()) },
    timeline: {
      sync: unused,
      backfillEnhancements: unused,
      backfillSeason: unused,
      read: async () => EMPTY_CHARACTER_TIMELINE,
      readPage: unused,
      // 실패한 수는 주기마다 다시 쓰므로, 닫은 뒤에도 시도가 늘면 주기 쓰기가 멈추지 않은 것이다.
      writeQueueCounts: async (counts) => {
        attempts.push(counts)
        throw new Error('synthetic write failure')
      },
      close: async () => undefined
    },
    todayGrade: { fetchShopGrade: unused },
    writeAccessLog: (line) => {
      logs.push(line)
    },
    queueCountsIntervalMs: INTERVAL_MS
  })

  while (attempts.length < 2) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
  }

  await app.close()
  const attemptsAtClose = attempts.length
  await new Promise((resolve) => setTimeout(resolve, 10))

  assert.deepEqual(attempts[0], [
    idle('timeline-sync'),
    idle('enhancement-backfill'),
    idle('season-backfill')
  ])
  assert.equal(attempts.length, attemptsAtClose)
  assert.ok(
    logs.some((line) => JSON.parse(line).code === 'TIMELINE_QUEUE_COUNTS_WRITE_FAILED'),
    logs.join('\n')
  )
})

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

test('queue 개수는 처리 중인 일과 동시 실행 한도에 막혀 기다리는 일을 따로 세고, 닫으면 대기만 비운다', async () => {
  const running = gate()
  const queue = createSeasonBackfillQueue(
    () => running.promise,
    () => assert.fail('백필 실패가 보고되면 안 된다')
  )
  const range = { start: new Date('2025-01-09T00:00:00Z'), end: new Date('2025-03-01T00:00:00Z') }
  for (const characterId of ['a', 'b', 'c', 'd']) {
    queue.request({ character: { serverId: 'cain', characterId }, seasonId: 1, range })
  }
  queue.request({ character: { serverId: 'cain', characterId: 'a' }, seasonId: 1, range })

  assert.deepEqual(queue.counts(), { waiting: 2, running: 2 })

  queue.close()

  assert.deepEqual(queue.counts(), { waiting: 0, running: 2 })

  running.release()
  await nextTurn()

  assert.deepEqual(queue.counts(), { waiting: 0, running: 0 })
})

// 합성 캐릭터다. 상세 조회가 성공해야 타임라인 queue에 일이 들어간다.
function detailPayloads(identity: CharacterIdentity): CharacterPayloads {
  const common = { ...identity, characterName: '합성 캐릭터', jobId: 'job' }

  return {
    basic: { ...common },
    status: { ...common, status: [], buff: [] },
    equipment: { ...common, equipment: [], setItemInfo: [] },
    avatar: { ...common, avatar: [] },
    creature: { ...common, creature: null },
    oath: { ...common, oath: null },
    mist_assimilation: { ...common, mistAssimilation: null },
    skill_style: { ...common, skill: { style: { active: [] } } },
    buff_equipment: { ...common, skill: { buff: null } },
    buff_avatar: { ...common, skill: { buff: null } },
    buff_creature: { ...common, skill: { buff: null } }
  }
}

test('공개 app은 타임라인 동기화, 강화 백필, 옛 시즌 백필 queue 개수를 각각 센다', async (t) => {
  const blocked = gate()
  const { app: publicApp, readQueueCounts } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async (identity) => detailPayloads(identity),
      catalog: new CatalogService(async () => new Map())
    },
    timeline: {
      sync: () => blocked.promise,
      backfillEnhancements: async ({ characterId }) => {
        if (characterId === 'first') {
          await blocked.promise
        }
      },
      backfillSeason: async () => assert.fail('옛 시즌 받기를 부르면 안 된다'),
      read: async () => EMPTY_CHARACTER_TIMELINE,
      readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
      close: async () => undefined
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined
  })
  t.after(async () => {
    blocked.release()
    await publicApp.close()
  })
  await publicApp.listen(0, '127.0.0.1')
  const publicOrigin = await publicApp.getUrl()

  for (const characterId of ['first', 'second']) {
    const detail = await fetch(`${publicOrigin}/characters/cain/${characterId}`)
    assert.equal(detail.status, 200, characterId)
  }

  assert.deepEqual(readQueueCounts(), [
    { name: 'timeline-sync', waiting: 0, running: 2 },
    { name: 'enhancement-backfill', waiting: 0, running: 1 },
    { name: 'season-backfill', waiting: 0, running: 0 }
  ])
})
