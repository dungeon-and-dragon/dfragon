import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type { CharacterBasicInput, CollectedCharacter, DatabaseClient } from '@dfragon/database'
import { type CharacterTimelineQuery, NeopleRequestFailure } from '@dfragon/neople'
import {
  CharacterActivityService,
  UNAVAILABLE_PAUSE_MS,
  createFameRefreshJob,
  createInactiveRecheckJob
} from '../src/application/character-activity/activity-jobs.js'
import type {
  CharacterActivityPorts,
  LatestActivity
} from '../src/application/character-activity/ports.js'
import type { CharacterActivityRepository } from '../src/application/character-activity/repository.js'
import { CharacterCollectionFailure } from '../src/domain/character-collection/failure.js'
import {
  CHARACTER_ACTIVITY_POOL,
  DatabaseCharacterActivityRepository
} from '../src/infrastructure/database/character-activity.js'
import { createJobSchedule } from '../src/infrastructure/jobs/scheduler.js'
import { createNeopleLatestActivity } from '../src/infrastructure/neople/character-activity.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-19T03:00:00+09:00')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS)

// 합성 캐릭터다. lastPlayedAt은 Neople 타임라인의 가장 최근 기록 시각이고 null이면 기록이 없다.
type SyntheticCharacter = CollectedCharacter & {
  fame: number
  lastPlayedAt: Date | null
  lastActiveAt: Date | null
  inactiveSince: Date | null
}

const keyOf = ({ serverId, characterId }: CollectedCharacter) => `${serverId}/${characterId}`

const compareKeys = (left: CollectedCharacter, right: CollectedCharacter) =>
  left.serverId === right.serverId
    ? left.characterId.localeCompare(right.characterId)
    : left.serverId.localeCompare(right.serverId)

function synthetic(
  characterId: string,
  fields: Partial<Omit<SyntheticCharacter, 'serverId' | 'characterId'>> = {}
): SyntheticCharacter {
  return {
    serverId: 'cain',
    characterId,
    fame: 50_000,
    lastPlayedAt: daysAgo(1),
    lastActiveAt: null,
    inactiveSince: null,
    ...fields
  }
}

// characters 테이블처럼 (server_id, character_id) 순으로 after 다음부터 읽는 메모리 저장소와, 타임라인과 기본 정보를 답하는 가짜 Neople이다.
function activity(
  characters: readonly SyntheticCharacter[],
  fail: (call: 'timeline' | 'basic', key: string, attempt: number) => Error | undefined = () =>
    undefined
) {
  const stored = new Map(characters.map((character) => [keyOf(character), { ...character }]))
  const recordedFame = new Map<string, number>()
  const timelineCalls: string[] = []
  const basicCalls: string[] = []
  const pauses: number[] = []
  const attempts = new Map<string, number>()
  const attemptOf = (call: string, character: CollectedCharacter) => {
    const key = `${call}:${keyOf(character)}`
    const attempt = (attempts.get(key) ?? 0) + 1
    attempts.set(key, attempt)

    return attempt
  }

  const rows = (
    filter: (character: SyntheticCharacter) => boolean,
    after: CollectedCharacter | null
  ) =>
    [...stored.values()]
      .filter(filter)
      .filter((character) => after === null || compareKeys(character, after) > 0)
      .sort(compareKeys)

  const repository: CharacterActivityRepository = {
    countRefreshTargets: async () =>
      rows(({ inactiveSince }) => inactiveSince === null, null).length,
    readRefreshTargets: async (after, limit) =>
      rows(({ inactiveSince }) => inactiveSince === null, after)
        .slice(0, limit)
        .map(({ serverId, characterId, lastActiveAt }) => ({
          serverId,
          characterId,
          lastActiveAt
        })),
    countInactive: async () => rows(({ inactiveSince }) => inactiveSince !== null, null).length,
    readInactive: async (after, limit) =>
      rows(({ inactiveSince }) => inactiveSince !== null, after)
        .slice(0, limit)
        .map(({ serverId, characterId }) => ({ serverId, characterId })),
    recordActive: async (character, lastActiveAt) => {
      Object.assign(stored.get(keyOf(character))!, { lastActiveAt, inactiveSince: null })
    },
    recordInactive: async (character, inactiveSince) => {
      Object.assign(stored.get(keyOf(character))!, { inactiveSince })
    },
    recordBasic: async (basic) => {
      assert.ok(basic.fame !== null)
      recordedFame.set(keyOf(basic), basic.fame)
    }
  }

  const ports: CharacterActivityPorts = {
    fetchLatestActivity: async (character, range): Promise<LatestActivity> => {
      timelineCalls.push(keyOf(character))

      if (fail('timeline', keyOf(character), attemptOf('timeline', character)) !== undefined) {
        return { status: 'unavailable' }
      }

      const { lastPlayedAt } = stored.get(keyOf(character))!

      if (lastPlayedAt === null || lastPlayedAt < range.start || lastPlayedAt > range.end) {
        return { status: 'idle' }
      }

      return { status: 'active', lastActiveAt: lastPlayedAt }
    },
    fetchBasic: async (character): Promise<CharacterBasicInput> => {
      basicCalls.push(keyOf(character))
      const failure = fail('basic', keyOf(character), attemptOf('basic', character))

      if (failure !== undefined) {
        throw failure
      }

      const { fame } = stored.get(keyOf(character))!

      return {
        ...character,
        characterName: `합성-${character.characterId}`,
        adventureName: '합성 모험단',
        level: 115,
        jobId: 'job-a',
        jobGrowId: 'grow-a1',
        jobName: '합성 직업',
        jobGrowName: '합성 전직',
        fame,
        guildId: null,
        guildName: null
      }
    },
    readConcurrency: () => 4,
    now: () => NOW,
    pause: async (ms) => {
      pauses.push(ms)
    },
    report: () => undefined
  }

  const service = new CharacterActivityService(repository, ports)

  return {
    service,
    stored: (characterId: string) => stored.get(`cain/${characterId}`)!,
    recordedFame,
    timelineCalls,
    basicCalls,
    pauses
  }
}

const ignoreProgress = () => undefined

test('명성 갱신은 30일 안에 타임라인이 있는 캐릭터의 명성을 저장하고 마지막 활동 시각을 남김', async () => {
  const run = activity([synthetic('active', { fame: 61_234, lastPlayedAt: daysAgo(3) })])

  const summary = await run.service.refreshFame(ignoreProgress)

  assert.deepEqual(summary, { characters: 1, refreshed: 1, inactive: 0, skipped: 0 })
  assert.equal(run.recordedFame.get('cain/active'), 61_234)
  assert.deepEqual(run.stored('active').lastActiveAt, daysAgo(3))
  assert.equal(run.stored('active').inactiveSince, null)
})

test('명성 갱신은 30일 동안 타임라인이 없는 캐릭터를 비활성으로 기록하고 기본 정보를 부르지 않음', async () => {
  const run = activity([
    synthetic('quit', { lastPlayedAt: daysAgo(31) }),
    synthetic('never', { lastPlayedAt: null })
  ])

  const summary = await run.service.refreshFame(ignoreProgress)

  assert.deepEqual(summary, { characters: 2, refreshed: 0, inactive: 2, skipped: 0 })
  assert.deepEqual(run.basicCalls, [])
  assert.deepEqual(run.stored('quit').inactiveSince, NOW)
  assert.deepEqual(run.stored('never').inactiveSince, NOW)
})

test('마지막 활동이 30일 안으로 기록된 캐릭터는 타임라인을 다시 부르지 않고 명성만 받음', async () => {
  const run = activity([
    synthetic('recent', { lastActiveAt: daysAgo(29), lastPlayedAt: daysAgo(29) }),
    synthetic('stale', { lastActiveAt: daysAgo(30), lastPlayedAt: daysAgo(2) })
  ])

  await run.service.refreshFame(ignoreProgress)

  assert.deepEqual(run.timelineCalls, ['cain/stale'])
  assert.deepEqual([...run.recordedFame.keys()].sort(), ['cain/recent', 'cain/stale'])
})

test('비활성 캐릭터는 명성 갱신 대상에서 빠짐', async () => {
  const run = activity([
    synthetic('inactive', { inactiveSince: daysAgo(10), lastPlayedAt: daysAgo(1) }),
    synthetic('active')
  ])

  const summary = await run.service.refreshFame(ignoreProgress)

  assert.equal(summary.characters, 1)
  assert.ok(!run.timelineCalls.includes('cain/inactive'))
  assert.ok(!run.basicCalls.includes('cain/inactive'))
})

test('실행 중에 비활성이 된 캐릭터가 대상에서 빠져도 한 페이지 넘는 남은 캐릭터를 건너뛰지 않음', async () => {
  // 페이지 크기 1024보다 많게 두고, 한 명 걸러 비활성으로 바뀌어 실행 중에 대상 목록이 줄어드는 경우다.
  const characters = Array.from({ length: 3000 }, (_, index) =>
    synthetic(`c${String(index).padStart(4, '0')}`, {
      lastPlayedAt: index % 2 === 0 ? daysAgo(40) : daysAgo(1)
    })
  )
  const run = activity(characters)

  const summary = await run.service.refreshFame(ignoreProgress)

  assert.deepEqual(summary, { characters: 3000, refreshed: 1500, inactive: 1500, skipped: 0 })
  assert.equal(new Set(run.timelineCalls).size, 3000)
})

test('묶음 전체가 Neople 점검, 한도 초과로 실패하면 쉬었다가 같은 캐릭터를 다시 부름', async () => {
  const run = activity([synthetic('a'), synthetic('b')], (call, _key, attempt) =>
    call === 'timeline' && attempt === 1 ? new CharacterCollectionFailure('unavailable') : undefined
  )

  const summary = await run.service.refreshFame(ignoreProgress)

  assert.deepEqual(run.pauses, [UNAVAILABLE_PAUSE_MS])
  assert.deepEqual(summary, { characters: 2, refreshed: 2, inactive: 0, skipped: 0 })
})

test('묶음 일부만 Neople 점검, 한도 초과로 실패하면 쉬지 않고 실패한 캐릭터만 다시 부름', async () => {
  const run = activity([synthetic('a'), synthetic('b')], (call, key, attempt) =>
    call === 'timeline' && key === 'cain/a' && attempt === 1
      ? new CharacterCollectionFailure('unavailable')
      : undefined
  )

  const summary = await run.service.refreshFame(ignoreProgress)

  assert.deepEqual(run.pauses, [])
  assert.deepEqual(summary, { characters: 2, refreshed: 2, inactive: 0, skipped: 0 })
  assert.equal(run.timelineCalls.filter((key) => key === 'cain/b').length, 1)
})

test('기본 정보가 캐릭터 문제로 실패하면 그 캐릭터만 건너뜀', async () => {
  const run = activity([synthetic('a'), synthetic('b')], (call, key) =>
    call === 'basic' && key === 'cain/b' ? new CharacterCollectionFailure('api') : undefined
  )

  const summary = await run.service.refreshFame(ignoreProgress)

  assert.deepEqual(summary, { characters: 2, refreshed: 1, inactive: 0, skipped: 1 })
  assert.deepEqual(run.pauses, [])
})

test('월말 재확인은 30일 안에 활동이 생긴 비활성 캐릭터만 활성으로 돌리고 다음 명성 갱신에 넣음', async () => {
  const run = activity([
    synthetic('returned', { inactiveSince: daysAgo(20), lastPlayedAt: daysAgo(2) }),
    synthetic('gone', { inactiveSince: daysAgo(20), lastPlayedAt: daysAgo(45) })
  ])

  const summary = await run.service.recheckInactive(ignoreProgress)

  assert.deepEqual(summary, { characters: 2, reactivated: 1, inactive: 1, skipped: 0 })
  assert.deepEqual(run.basicCalls, [])
  assert.equal(run.stored('returned').inactiveSince, null)
  assert.deepEqual(run.stored('returned').lastActiveAt, daysAgo(2))
  assert.deepEqual(run.stored('gone').inactiveSince, daysAgo(20))

  await run.service.refreshFame(ignoreProgress)

  assert.deepEqual([...run.recordedFame.keys()], ['cain/returned'])
})

test('명성 갱신은 매일 03:00, 비활성 재확인은 매월 마지막 날 04:00(KST)에 돔', () => {
  const service = activity([]).service
  const nextRun = (schedule: string | undefined, from: string) =>
    createJobSchedule(schedule!).nextRun(new Date(from))?.toISOString()

  assert.equal(
    nextRun(createFameRefreshJob(service).schedule, '2026-11-19T03:30:00+09:00'),
    new Date('2026-11-20T03:00:00+09:00').toISOString()
  )
  assert.equal(
    nextRun(createInactiveRecheckJob(service).schedule, '2026-11-19T12:00:00+09:00'),
    new Date('2026-11-30T04:00:00+09:00').toISOString()
  )
  assert.equal(
    nextRun(createInactiveRecheckJob(service).schedule, '2027-02-01T00:00:00+09:00'),
    new Date('2027-02-28T04:00:00+09:00').toISOString()
  )
})

test('최근 활동 조회는 30일 범위를 KST로 보내고 가장 최근 한 행을 마지막 활동 시각으로 읽음', async () => {
  const queries: CharacterTimelineQuery[] = []
  const pages = [[{ code: 201, name: '던전 입장', date: '2026-11-17 21:05', data: {} }], []]
  const fetch = createNeopleLatestActivity({
    characterTimeline: async (_identity, query) => {
      queries.push(query)

      return { timeline: { rows: pages.shift()!, next: null } }
    }
  })
  const range = { start: daysAgo(30), end: NOW }
  const character = { serverId: 'cain', characterId: 'a' }

  assert.deepEqual(await fetch(character, range), {
    status: 'active',
    lastActiveAt: new Date('2026-11-17T21:05:00+09:00')
  })
  assert.deepEqual(await fetch(character, range), { status: 'idle' })

  const [query] = queries
  assert.ok(query !== undefined && 'limit' in query)
  assert.equal(query.limit, 1)
  assert.equal(query.startDate, '20261020T0300')
  assert.equal(query.endDate, '20261119T0300')
})

test('최근 활동 조회는 Neople 점검, timeout을 unavailable로, 나머지 실패를 failed로 나눔', async () => {
  const failing = (failure: NeopleRequestFailure) =>
    createNeopleLatestActivity({
      characterTimeline: async () => {
        throw failure
      }
    })({ serverId: 'cain', characterId: 'a' }, { start: daysAgo(30), end: NOW })

  assert.deepEqual(await failing(new NeopleRequestFailure('unavailable')), {
    status: 'unavailable'
  })
  assert.deepEqual(await failing(new NeopleRequestFailure('timeout')), { status: 'unavailable' })
  assert.deepEqual(await failing(new NeopleRequestFailure('api')), { status: 'failed' })
})

test('명성 갱신 저장은 수백 명을 함께 받아도 전용 pool 크기만큼만 transaction을 함께 염', async () => {
  let open = 0
  let mostOpen = 0
  let committed = 0
  // 저장 함수가 여는 interactive transaction만 흉내 낸다. 실제 쿼리는 DB 계층 테스트가 확인한다.
  const client = {
    $transaction: async () => {
      open++
      mostOpen = Math.max(mostOpen, open)
      await setImmediate()
      open--
      committed++
    }
  } as unknown as DatabaseClient
  const repository = new DatabaseCharacterActivityRepository(client)
  const basics = Array.from({ length: 600 }, (_, index) => ({
    serverId: 'cain',
    characterId: `c${index}`,
    characterName: `합성-${index}`,
    adventureName: '합성 모험단',
    level: 115,
    jobId: 'job-a',
    jobGrowId: 'grow-a1',
    jobName: '합성 직업',
    jobGrowName: '합성 전직',
    fame: 50_000,
    guildId: null,
    guildName: null
  }))

  await Promise.all(basics.map((basic) => repository.recordBasic(basic)))

  assert.equal(committed, 600)
  assert.equal(mostOpen, CHARACTER_ACTIVITY_POOL.maxConnections)
})
