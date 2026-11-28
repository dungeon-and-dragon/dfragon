import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type { TimelineSyncRequest, TimelineSyncRequestKind } from '@dfragon/database'
import type { FetchCharacterTimeline } from '@dfragon/server-core/application/character-timeline/ports.js'
import {
  TimelineFailure,
  type TimelineInputs,
  type TimelineSyncFailure
} from '@dfragon/server-core/domain/character-timeline/index.js'
import type { TimelineSyncRequestPorts } from '../src/application/timeline-sync/ports.js'
import type { TimelineSyncRequestRepository } from '../src/application/timeline-sync/repository.js'
import {
  type TimelineSyncRequestRepositories,
  TimelineSyncRequestService
} from '../src/application/timeline-sync/sync-requests.js'

const emptyInputs: TimelineInputs = { events: [], items: [] }
const seasons = [
  { id: 9, name: '합성 이전 시즌', startsAt: new Date('2024-06-20T06:00:00+09:00') },
  { id: 10, name: '합성 다음 시즌', startsAt: new Date('2025-01-09T06:00:00+09:00') }
]

const request = (
  kind: TimelineSyncRequestKind,
  characterId: string,
  seasonId = 0
): TimelineSyncRequest => ({ kind, serverId: 'cain', characterId, seasonId })

const keyOf = ({ kind, serverId, characterId, seasonId }: TimelineSyncRequest) =>
  `${kind}/${serverId}/${characterId}/${seasonId}`

// 요청 테이블의 행 상태만 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다. 집는 순서는 컨테이너 검사가 실제 PostgreSQL에서 확인한다.
function memoryRequests(seed: { request: TimelineSyncRequest; started?: boolean }[]) {
  const rows = new Map(seed.map(({ request, started }) => [keyOf(request), { request, started }]))
  const repository: TimelineSyncRequestRepository = {
    releaseStarted: async () => {
      for (const row of rows.values()) {
        row.started = false
      }
    },
    claim: async (kind, limit) => {
      const picked = [...rows.values()].filter((row) => row.request.kind === kind && !row.started)

      return picked.slice(0, limit).map((row) => {
        row.started = true

        return row.request
      })
    },
    remove: async (removed) => {
      rows.delete(keyOf(removed))
    },
    release: async (released) => {
      const row = rows.get(keyOf(released))
      if (row !== undefined) {
        row.started = false
      }
    },
    readSeasons: async () => seasons
  }

  return {
    repository,
    add: (added: TimelineSyncRequest) => {
      rows.set(keyOf(added), { request: added, started: false })
    },
    keys: () => [...rows.keys()],
    started: () => [...rows.values()].filter((row) => row.started).map((row) => keyOf(row.request))
  }
}

// 처음 받는 캐릭터라 종류마다 Neople을 부르는 저장소 fake다.
function freshCharacterStores() {
  const syncFailures: TimelineSyncFailure[] = []

  return {
    syncFailures,
    sync: {
      readSyncState: async () => undefined,
      replaceRange: async () => {},
      recordActive: async () => {},
      recordSuccess: async () => {},
      recordFailure: async (_character, failure) => {
        syncFailures.push(failure)
      }
    },
    enhancementBackfill: { readBackfilledUntil: async () => null, replaceRange: async () => {} },
    seasonBackfill: {
      readState: async () => undefined,
      replaceRange: async () => {},
      recordCompleted: async () => {}
    }
  } satisfies Omit<TimelineSyncRequestRepositories, 'requests'> & {
    syncFailures: TimelineSyncFailure[]
  }
}

// held에 든 길이의 쉼만 테스트가 풀 때까지 붙잡고 나머지는 바로 끝낸다. 테스트가 끝나면 모든 쉼을 붙잡아 끝없는 루프를 세운다.
function pauses(t: TestContext, held: readonly number[]) {
  const waiting: { milliseconds: number; resume: () => void }[] = []
  let finished = false
  t.after(() => {
    finished = true
  })

  return {
    waiting,
    pause: async (milliseconds: number) => {
      if (!finished && !held.includes(milliseconds)) {
        await setImmediate()

        return
      }

      await new Promise<void>((resolve) => {
        waiting.push({ milliseconds, resume: resolve })
      })
    }
  }
}

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (condition()) {
      return
    }

    await setImmediate()
  }

  assert.fail('조건에 닿지 않았다')
}

function startService(
  requests: ReturnType<typeof memoryRequests>,
  ports: Pick<TimelineSyncRequestPorts, 'fetchTimeline' | 'pause'> &
    Partial<Pick<TimelineSyncRequestPorts, 'fetchEnhancementTimeline'>>
) {
  const stores = freshCharacterStores()
  const reports: Parameters<TimelineSyncRequestPorts['report']>[] = []
  const service = new TimelineSyncRequestService(
    { requests: requests.repository, ...stores },
    {
      fetchTimeline: ports.fetchTimeline,
      fetchEnhancementTimeline: ports.fetchEnhancementTimeline ?? ports.fetchTimeline,
      itemDictionary: { fill: async () => 0 },
      report: (code, details) => {
        reports.push([code, details])
      },
      pause: ports.pause
    }
  )
  // run은 끝나지 않는다. lane이 실패해 끝나면 처리되지 않은 rejection으로 테스트를 실패시킨다.
  service.run().catch((error: unknown) => {
    assert.ifError(error)
  })

  return { reports, syncFailures: stores.syncFailures }
}

test('시작하면 끝난 worker가 집어 둔 요청을 다시 처리해 지우고, 빈 테이블은 0.5초 뒤 다시 보아 새 요청을 처리한다', async (t) => {
  const requests = memoryRequests([{ request: request('sync', 'interrupted'), started: true }])
  const fetched: string[] = []
  const { waiting, pause } = pauses(t, [500])

  startService(requests, {
    fetchTimeline: async ({ characterId }) => {
      fetched.push(characterId)

      return emptyInputs
    },
    pause
  })

  await waitUntil(() => requests.keys().length === 0)
  assert(fetched.includes('interrupted'))

  // 세 종류의 lane이 모두 빈 테이블을 보고 0.5초 쉬는 중이라, 쉼을 풀기 전에는 새 요청을 집지 않는다.
  await waitUntil(() => waiting.filter(({ milliseconds }) => milliseconds === 500).length === 3)
  requests.add(request('sync', 'later'))

  for (let turn = 0; turn < 10; turn++) {
    await setImmediate()
  }

  assert(!fetched.includes('later'))

  for (const { resume } of waiting.splice(0)) {
    resume()
  }

  await waitUntil(() => requests.keys().length === 0)
  assert(fetched.includes('later'))
})

test('종류마다 정기 동기화 16, 강화 백필 4, 옛 시즌 받기 2개까지만 함께 처리하고, 하나가 끝나면 다음 요청을 집는다', async (t) => {
  const seed = [
    ...Array.from({ length: 20 }, (_, index) => request('sync', `sync-${index}`)),
    ...Array.from({ length: 6 }, (_, index) =>
      request('enhancement-backfill', `backfill-${index}`)
    ),
    ...Array.from({ length: 3 }, (_, index) => request('season-backfill', `season-${index}`, 9))
  ]
  const requests = memoryRequests(seed.map((seeded) => ({ request: seeded })))
  const held = new Map<string, () => void>()
  const heldOf = (prefix: string) => [...held.keys()].filter((id) => id.startsWith(prefix))
  const { pause } = pauses(t, [])
  // 요청마다 첫 구간만 붙잡아, 풀어 주면 나머지 구간을 바로 받고 끝난다.
  const hold: FetchCharacterTimeline = async ({ characterId }) => {
    if (held.has(characterId)) {
      return emptyInputs
    }

    return new Promise((resolve) => {
      held.set(characterId, () => {
        resolve(emptyInputs)
      })
    })
  }
  startService(requests, { fetchTimeline: hold, pause })

  await waitUntil(() => held.size === 22)
  await setImmediate()
  assert.equal(heldOf('sync-').length, 16)
  assert.equal(heldOf('backfill-').length, 4)
  assert.equal(heldOf('season-').length, 2)
  assert.equal(requests.started().length, 22)

  held.get('backfill-0')?.()
  await waitUntil(() => heldOf('backfill-').length === 5)
  assert.equal(heldOf('sync-').length, 16)
  assert(!requests.keys().includes(keyOf(request('enhancement-backfill', 'backfill-0'))))
})

test('집는 요청이 LIMIT보다 많이 와 처리 중인 요청이 상한을 넘으면 0 이하로 집지 않고 기다렸다가, 상한 아래로 내려오면 다시 집는다', async (t) => {
  const seed = Array.from({ length: 4 }, (_, index) =>
    request('season-backfill', `season-${index}`, 9)
  )
  const requests = memoryRequests(seed.map((seeded) => ({ request: seeded })))
  const held = new Map<string, () => void>()
  const { pause } = pauses(t, [])
  let overflowed = false

  // 상한을 넘은 원인은 모르지만 그 상태를 만들려고 첫 번째로 집을 때만 LIMIT보다 한 개 더 돌려준다.
  // PostgreSQL처럼 0 이하의 LIMIT은 거절해, lane이 실패하면 startService가 테스트를 실패시킨다.
  const claim = requests.repository.claim
  requests.repository.claim = async (kind, limit) => {
    assert(limit > 0, `LIMIT ${limit}`)

    if (kind === 'season-backfill' && !overflowed) {
      overflowed = true

      return claim(kind, limit + 1)
    }

    return claim(kind, limit)
  }

  startService(requests, {
    fetchTimeline: async ({ characterId }) => {
      if (held.has(characterId)) {
        return emptyInputs
      }

      return new Promise((resolve) => {
        held.set(characterId, () => {
          resolve(emptyInputs)
        })
      })
    },
    pause
  })

  await waitUntil(() => held.size === 3)
  held.get('season-0')?.()
  held.get('season-1')?.()
  await waitUntil(() => held.size === 4)
})

for (const kind of ['sync', 'enhancement-backfill', 'season-backfill'] as const) {
  test(`${kind} 요청이 쓸 Neople key가 없어 실패하면 행을 남겨 되돌리고 60초 쉰 뒤 다시 처리한다`, async (t) => {
    const requests = memoryRequests([{ request: request(kind, 'no-key', 9) }])
    let keys = false
    const { waiting, pause } = pauses(t, [60_000])
    const { reports } = startService(requests, {
      fetchTimeline: async () => {
        if (!keys) {
          throw new TimelineFailure('unavailable', { keyShortage: 'no-key' })
        }

        return emptyInputs
      },
      pause
    })

    await waitUntil(() => waiting.some(({ milliseconds }) => milliseconds === 60_000))
    assert.deepEqual(requests.keys(), [keyOf(request(kind, 'no-key', 9))])
    assert.deepEqual(requests.started(), [])
    assert.deepEqual(reports, [['TIMELINE_SYNC_NEOPLE_UNAVAILABLE', { kind }]])

    keys = true

    for (const { resume } of waiting.splice(0)) {
      resume()
    }

    await waitUntil(() => requests.keys().length === 0)
  })
}

test('정기 동기화가 key와 무관한 Neople 실패로 끝나면 실패를 동기화 상태에 남기고 행을 지운다', async (t) => {
  const requests = memoryRequests([{ request: request('sync', 'maintenance') }])
  const { waiting, pause } = pauses(t, [60_000])
  const { reports, syncFailures } = startService(requests, {
    fetchTimeline: async () => {
      throw new TimelineFailure('unavailable', { upstream: { status: 503, code: 'DNF980' } })
    },
    pause
  })

  await waitUntil(() => requests.keys().length === 0)
  assert.deepEqual(syncFailures, ['neople-unavailable'])
  assert.deepEqual(reports, [])
  assert(!waiting.some(({ milliseconds }) => milliseconds === 60_000))
})

test('강화 백필이 key와 무관한 실패로 끝나면 TIMELINE_BACKFILL_FAILED를 알리고 행을 지운다', async (t) => {
  const requests = memoryRequests([{ request: request('enhancement-backfill', 'broken') }])
  const { pause } = pauses(t, [])
  const { reports } = startService(requests, {
    fetchTimeline: async () => emptyInputs,
    fetchEnhancementTimeline: async () => {
      throw new TimelineFailure('api')
    },
    pause
  })

  await waitUntil(() => requests.keys().length === 0)
  assert.deepEqual(reports, [['TIMELINE_BACKFILL_FAILED', undefined]])
})
