import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type { TimelineSyncStateRow } from '@dfragon/database'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { NeopleStageTimings } from '@dfragon/server-core/application/character-detail/index.js'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import { EMPTY_CHARACTER_TIMELINE } from '@dfragon/server-core/domain/character-timeline/index.js'
import { CharacterDetailService } from '../src/application/character-detail/service.js'
import { TimelineSyncRequestService } from '../src/application/character-timeline/sync-requests.js'
import { emptyAdventureGuildRepository } from '../src/application/adventure-guild/service.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'
import { memoryTimelineRequests } from './timeline-request-fixtures.js'

const character = { serverId: 'siroco', characterId: 'timeline-fixture' }
const now = new Date('2026-11-25T12:00:00Z')
const MINUTE_MS = 60_000
const syncOf = (characterId: string) => ({
  kind: 'sync' as const,
  serverId: 'siroco',
  characterId,
  seasonId: 0
})

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

// 쉰 만큼 시계를 넘기는 가짜 시계다. 쉴 때마다 afterPause를 불러 그 사이 worker가 한 일을 흉내 낸다.
function fakeClock(afterPause: (paused: number[]) => void = () => undefined) {
  let at = now.getTime()
  const paused: number[] = []

  return {
    paused,
    ports: {
      now: () => new Date(at),
      pause: async (milliseconds: number) => {
        paused.push(milliseconds)
        at += milliseconds
        afterPause(paused)
        await nextTurn()
      }
    }
  }
}

const state = (
  characterId: string,
  fields: Partial<TimelineSyncStateRow>
): TimelineSyncStateRow => ({
  serverId: 'siroco',
  characterId,
  lastSucceededAt: null,
  enhancementBackfilledUntil: null,
  ...fields
})

test('1시간 안에 동기화에 성공한 캐릭터는 정기 동기화를, 끝까지 받은 캐릭터는 강화 백필을 넣지 않고, 모험단 화면 요청은 강화 백필을 넣지 않는다', async () => {
  const recentSuccess = new Date(now.getTime() - 59 * MINUTE_MS)
  const staleSuccess = new Date(now.getTime() - 61 * MINUTE_MS)
  const requests = memoryTimelineRequests([
    state('recent', { lastSucceededAt: recentSuccess }),
    state('stale', { lastSucceededAt: staleSuccess }),
    // 중천 시작(2025-01-09 06:00 KST) 직전 분까지 받은 캐릭터다.
    state('backfilled', { enhancementBackfilledUntil: new Date('2025-01-09T05:59:00+09:00') }),
    state('partial', { enhancementBackfilledUntil: new Date('2024-06-20T05:59:00+09:00') })
  ])
  const service = new TimelineSyncRequestService(requests.repository, fakeClock().ports)
  const characters = ['recent', 'stale', 'backfilled', 'partial', 'unseen'].map((characterId) => ({
    serverId: 'siroco',
    characterId
  }))

  await service.request(characters, { enhancementBackfill: true })
  await service.request([{ serverId: 'siroco', characterId: 'adventure' }], {
    enhancementBackfill: false
  })

  assert.deepEqual(
    requests.inserted.map(({ kind, characterId, awaited }) => `${kind}:${characterId}:${awaited}`),
    [
      'enhancement-backfill:recent:false',
      'sync:stale:false',
      'enhancement-backfill:stale:false',
      'sync:backfilled:false',
      'sync:partial:false',
      'enhancement-backfill:partial:false',
      'sync:unseen:false',
      'enhancement-backfill:unseen:false',
      'sync:adventure:false'
    ]
  )
})

test('타임라인 조회의 동기화는 기다리는 요청으로 넣고, worker가 행을 지우면 다음 확인에서 돌아간다', async () => {
  const requests = memoryTimelineRequests()
  const clock = fakeClock((paused) => {
    if (paused.length === 2) {
      requests.remove(syncOf(character.characterId))
    }
  })
  const service = new TimelineSyncRequestService(requests.repository, clock.ports)

  await service.syncAndWait(character)

  assert.deepEqual(requests.inserted, [{ ...syncOf(character.characterId), awaited: true }])
  assert.deepEqual(clock.paused, [250, 250])
})

test('행이 남아 있으면 10초까지 기다린 뒤 동기화가 끝나지 않은 채 돌아간다', async () => {
  const requests = memoryTimelineRequests()
  const clock = fakeClock()
  const service = new TimelineSyncRequestService(requests.repository, clock.ports)

  await service.syncAndWait(character)

  assert.equal(
    clock.paused.reduce((sum, paused) => sum + paused, 0),
    10_000
  )
  assert.deepEqual(requests.keys(), ['sync/siroco/timeline-fixture/0'])
})

test('1시간 안에 동기화에 성공한 캐릭터의 타임라인 조회는 요청을 넣지 않고 기다리지 않는다', async () => {
  const lastSucceededAt = new Date(now.getTime() - 30 * MINUTE_MS)
  const requests = memoryTimelineRequests([state(character.characterId, { lastSucceededAt })])
  const clock = fakeClock()
  const service = new TimelineSyncRequestService(requests.repository, clock.ports)

  await service.syncAndWait(character)

  assert.deepEqual(requests.inserted, [])
  assert.deepEqual(clock.paused, [])
})

test('닫으면 기다리던 동기화는 다음 확인에서 돌아간다', async () => {
  const requests = memoryTimelineRequests()
  let service!: TimelineSyncRequestService
  const clock = fakeClock((paused) => {
    if (paused.length === 1) {
      service.close()
    }
  })
  service = new TimelineSyncRequestService(requests.repository, clock.ports)

  await service.syncAndWait(character)

  assert.deepEqual(clock.paused, [250])
  assert.deepEqual(requests.keys(), ['sync/siroco/timeline-fixture/0'])
})

test('옛 시즌 받기 요청을 넣으면 그 시즌만 받는 중이고, 행이 없어지면 받는 중이 아니다', async () => {
  const requests = memoryTimelineRequests()
  const service = new TimelineSyncRequestService(requests.repository, fakeClock().ports)
  const range = {
    start: new Date('2023-09-14T06:00:00+09:00'),
    end: new Date('2025-01-09T05:59:00+09:00')
  }

  await service.requestSeasonBackfill([{ character, seasonId: 9, range }])

  assert.deepEqual([...(await service.readSeasonBackfillRunning([character]))], [9])
  assert.deepEqual(
    [...(await service.readSeasonBackfillRunning([{ serverId: 'siroco', characterId: 'other' }]))],
    []
  )

  requests.remove({ ...syncOf(character.characterId), kind: 'season-backfill', seasonId: 9 })

  assert.deepEqual([...(await service.readSeasonBackfillRunning([character]))], [])
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

test('상세 조회는 요청 넣기를 기다리지 않고 응답하고, 그 캐릭터의 정기 동기화와 강화 백필을 넣는다', {
  timeout: 10_000
}, async (t) => {
  const inserting = gate()
  const requests = memoryTimelineRequests()
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async () => payloads,
      catalog: new CatalogService(async () => new Map())
    },
    timeline: {
      read: async () => assert.fail('타임라인을 읽으면 안 된다'),
      readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
      requests: {
        ...requests.repository,
        request: async (inserted, options) => {
          await inserting.promise
          await requests.repository.request(inserted, options)
        }
      },
      close: async () => undefined
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined
  })
  t.after(async () => {
    inserting.release()
    await app.close()
  })
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  const detail = await fetch(new URL(`/characters/siroco/${character.characterId}`, origin))

  assert.equal(detail.status, 200)
  assert.deepEqual(requests.inserted, [])

  inserting.release()

  while (requests.inserted.length < 2) {
    await nextTurn()
  }

  assert.deepEqual(requests.keys(), [
    'sync/siroco/timeline-fixture/0',
    'enhancement-backfill/siroco/timeline-fixture/0'
  ])
})

// 닫기가 10초 상한까지 기다리면 이 테스트의 timeout 안에 끝나지 않는다.
test('앱을 닫으면 동기화를 기다리던 타임라인 조회가 그때 저장된 값으로 200을 답하고 타임라인 저장소를 닫는다', {
  timeout: 5_000
}, async () => {
  const requests = memoryTimelineRequests()
  let closed = 0
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async () => payloads,
      catalog: new CatalogService(async () => new Map())
    },
    timeline: {
      read: async () => EMPTY_CHARACTER_TIMELINE,
      readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
      requests: requests.repository,
      close: async () => {
        closed++
      }
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  const timeline = fetch(new URL(`/characters/siroco/${character.characterId}/timeline`, origin))

  while (requests.inserted.length === 0) {
    await nextTurn()
  }

  const closing = app.close()
  const response = await timeline
  await closing

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), EMPTY_CHARACTER_TIMELINE)
  assert.equal(closed, 1)
})

test('모험단 화면은 캐릭터마다 정기 동기화만 넣고 강화 백필은 넣지 않는다', async (t) => {
  const requests = memoryTimelineRequests()
  const characters = ['a', 'b'].map((characterId) => ({ serverId: 'siroco', characterId }))
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async () => assert.fail('상세 조회를 부르면 안 된다'),
      catalog: new CatalogService(async () => new Map())
    },
    adventureGuild: {
      ...emptyAdventureGuildRepository,
      readAdventureTimeline: async () => ({
        characters,
        page: { items: [], nextCursor: null }
      })
    },
    timeline: {
      read: async () => assert.fail('타임라인을 읽으면 안 된다'),
      readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
      requests: requests.repository,
      close: async () => undefined
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  const response = await fetch(
    new URL(`/adventures/${encodeURIComponent('합성 모험단')}/timeline`, origin)
  )

  assert.equal(response.status, 200)

  while (requests.inserted.length < 2) {
    await nextTurn()
  }

  assert.deepEqual(requests.keys(), ['sync/siroco/a/0', 'sync/siroco/b/0'])
})
