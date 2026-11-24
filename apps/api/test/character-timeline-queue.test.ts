import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type { TimelineCharacter } from '@dfragon/database'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { NeopleStageTimings } from '@dfragon/server-core/application/character-detail/index.js'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import { EMPTY_CHARACTER_TIMELINE } from '@dfragon/server-core/domain/character-timeline/index.js'
import { CharacterDetailService } from '../src/application/character-detail/service.js'
import {
  createEnhancementBackfillQueue,
  createTimelineSyncQueue
} from '../src/application/character-timeline/queue.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

const character = { serverId: 'siroco', characterId: 'timeline-fixture' }

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

test('같은 캐릭터를 진행 중에 여러 번 넣어도 한 번만 동기화하고, 다섯 번째 캐릭터는 앞 동기화가 끝난 뒤 시작한다', async () => {
  const running = gate()
  const synced: TimelineCharacter[] = []
  const queue = createTimelineSyncQueue(
    async (requested) => {
      synced.push(requested)
      await running.promise
    },
    () => assert.fail('동기화 실패가 보고되면 안 된다')
  )
  const others = [
    { serverId: 'siroco', characterId: 'other-1' },
    { serverId: 'siroco', characterId: 'other-2' },
    { serverId: 'cain', characterId: 'timeline-fixture' }
  ]
  const fifth = { serverId: 'siroco', characterId: 'other-3' }

  queue.request(character)
  queue.request(character)
  for (const other of others) {
    queue.request(other)
  }
  queue.request(fifth)
  queue.request(others[2]!)
  queue.request(character)
  await nextTurn()

  assert.deepEqual(synced, [character, ...others])
  assert.deepEqual(queue.counts(), { waiting: 1, running: 4 })

  running.release()
  await nextTurn()
  queue.request(character)
  await nextTurn()

  assert.deepEqual(synced, [character, ...others, fifth, character])
})

test('강화 백필은 캐릭터 2명까지만 함께 처리하고 세 번째는 앞 백필이 끝난 뒤 시작한다', async () => {
  const running = gate()
  const backfilled: string[] = []
  const queue = createEnhancementBackfillQueue(
    async ({ characterId }) => {
      backfilled.push(characterId)
      await running.promise
    },
    () => assert.fail('백필 실패가 보고되면 안 된다')
  )

  for (const characterId of ['first', 'second', 'third']) {
    queue.request({ serverId: 'siroco', characterId })
  }

  await nextTurn()

  assert.deepEqual(backfilled, ['first', 'second'])
  assert.deepEqual(queue.counts(), { waiting: 1, running: 2 })

  running.release()
  await nextTurn()

  assert.deepEqual(backfilled, ['first', 'second', 'third'])
})

test('동기화가 실패를 기록하지 못하면 보고하고 다른 캐릭터와 그 캐릭터의 다음 요청은 막지 않는다', async () => {
  const running = gate()
  let reported = 0
  const synced: string[] = []
  const queue = createTimelineSyncQueue(
    async ({ characterId }) => {
      synced.push(characterId)
      if (characterId === 'broken') {
        throw new Error('database closed')
      }
      await running.promise
    },
    () => {
      reported++
    }
  )

  for (const characterId of ['broken', 'second', 'third']) {
    queue.request({ serverId: 'siroco', characterId })
  }
  await nextTurn()

  assert.equal(reported, 1)
  assert.deepEqual(synced, ['broken', 'second', 'third'])

  queue.request({ serverId: 'siroco', characterId: 'broken' })
  await nextTurn()

  assert.equal(reported, 2)
  assert.deepEqual(synced, ['broken', 'second', 'third', 'broken'])
  running.release()
})

test('queue를 닫으면 진행 중인 동기화는 끝까지 두고 닫은 뒤 온 캐릭터는 시작하지 않는다', async () => {
  const running = gate()
  const synced: string[] = []
  const finished: string[] = []
  const queue = createTimelineSyncQueue(
    async ({ characterId }) => {
      synced.push(characterId)
      await running.promise
      finished.push(characterId)
    },
    () => assert.fail('동기화 실패가 보고되면 안 된다')
  )

  for (const characterId of ['first', 'second', 'third']) {
    queue.request({ serverId: 'siroco', characterId })
  }
  queue.close()
  queue.request({ serverId: 'siroco', characterId: 'after-close' })
  running.release()
  await nextTurn()

  assert.deepEqual(synced, ['first', 'second', 'third'])
  assert.deepEqual(finished, ['first', 'second', 'third'])
})

const ignoredTimings: NeopleStageTimings = { record: () => undefined, markShared: () => undefined }
const signal = new AbortController().signal
const common = { ...character, characterName: '합성 캐릭터', jobId: 'job' }
const payloads: CharacterPayloads = {
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

test('상세 조회는 캐시 적중에도 캐릭터를 받았다고 알리고, 캐릭터를 받지 못하면 알리지 않는다', async (t) => {
  const fetched: CharacterIdentity[] = []
  let found = true
  const service = new CharacterDetailService({
    catalog: new CatalogService(async () => new Map()),
    fetchDetails: async () => {
      if (!found) {
        throw new CharacterDetailFailure('api')
      }

      return payloads
    },
    calculateScore: async () => null,
    publishCharacterFetched: ({ serverId, characterId }) => {
      fetched.push({ serverId, characterId })
    }
  })
  t.after(() => service.close())

  await service.get(character, signal, ignoredTimings)
  const cached = await service.get(character, signal, ignoredTimings)
  found = false
  const missing = { serverId: 'siroco', characterId: 'missing' }
  await assert.rejects(service.get(missing, signal, ignoredTimings), CharacterDetailFailure)

  assert.equal(cached.reused, true)
  assert.deepEqual(fetched, [character, character])
})

test('상세 조회가 강화 백필을 요청하고, 타임라인 조회는 백필이 끝나기를 기다리지 않는다', {
  timeout: 10_000
}, async (t) => {
  const backfilling = gate()
  const backfilled: TimelineCharacter[] = []
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async () => payloads,
      catalog: new CatalogService(async () => new Map())
    },
    timeline: {
      sync: async () => undefined,
      read: async () => EMPTY_CHARACTER_TIMELINE,
      readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
      backfillSeason: async () => assert.fail('옛 시즌 받기를 부르면 안 된다'),
      backfillEnhancements: async (requested) => {
        backfilled.push(requested)
        await backfilling.promise
      },
      close: async () => undefined
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined
  })
  t.after(async () => {
    backfilling.release()
    await app.close()
  })
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  const detail = await fetch(new URL(`/characters/siroco/${character.characterId}`, origin))
  const timeline = await fetch(
    new URL(`/characters/siroco/${character.characterId}/timeline`, origin)
  )

  assert.equal(detail.status, 200)
  assert.equal(timeline.status, 200)
  assert.deepEqual(backfilled, [character])
})

// 닫기가 동기화를 기다리게 바뀌면 멈추지 않고 실패하도록 timeout을 둔다.
test('앱을 닫으면 진행 중인 동기화와 백필을 기다리지 않고, 대기하던 백필은 시작하지 않은 채 타임라인 저장소를 닫는다', {
  timeout: 10_000
}, async () => {
  const running = gate()
  let closed = 0
  let synced = 0
  let backfilled = 0
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async () => payloads,
      catalog: new CatalogService(async () => new Map())
    },
    timeline: {
      sync: async () => {
        synced++
        await running.promise
      },
      read: async () => assert.fail('타임라인을 읽으면 안 된다'),
      readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
      backfillSeason: async () => assert.fail('옛 시즌 받기를 부르면 안 된다'),
      backfillEnhancements: async () => {
        backfilled++
        await running.promise
      },
      close: async () => {
        closed++
      }
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  for (const characterId of ['first', 'second', 'third']) {
    const response = await fetch(new URL(`/characters/siroco/${characterId}`, origin))
    assert.equal(response.status, 200)
  }

  assert.equal(synced, 3)
  assert.equal(backfilled, 2)

  await app.close()
  running.release()
  await nextTurn()

  assert.equal(closed, 1)
  assert.equal(synced, 3)
  assert.equal(backfilled, 2)
})
