import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type {
  ClearPopulationCharacter,
  CollectedCharacter,
  ContentClearCollectionProgress,
  ContentClearInput,
  StoredClearPopulation
} from '@dfragon/database'
import { type NeopleClient, NeopleRequestFailure, type NeopleTimelineRow } from '@dfragon/neople'
import {
  createNeopleCharacterBasic,
  paceNeopleRequests
} from '../src/character-collection/adapters.js'
import type { CollectionStore } from '../src/character-collection/collect.js'
import { runCollectionPass } from '../src/character-collection/runner.js'
import { createContentClearCollectionJob } from '../src/content-clears/collection-job.js'
import {
  type ClearCollectionStore,
  UNAVAILABLE_PAUSE_MS,
  collectContentClears
} from '../src/content-clears/collection.js'
import { CLEAR_CONTENTS } from '../src/content-clears/contents.js'
import type { JobStore } from '../src/jobs/definition.js'
import { findCatchupJobs } from '../src/jobs/scheduler.js'
import { startOfResetWeek } from '../src/utils/seoul-time.js'

const at = (time: string) => new Date(`${time}:00+09:00`)
const NOW = at('2026-11-10T12:00')
const CURRENT_WEEK = at('2026-11-05T06:00')
const NIGHTMARE_TITLE_ID = '070577c19e70e3ea723bbc924b111a12'

// 합성 타임라인 기록이다. data는 운영 DB에서 본 Neople 응답의 필드 모양을 따른다.
type RaidData = Record<string, unknown>
const raidRow = (date: string, data: RaidData): NeopleTimelineRow => ({
  code: 201,
  name: '레이드',
  date,
  data: { raidPartyName: '합성 공격대', ...data }
})
const michaelaHard = (date: string, extra: RaidData = {}) =>
  raidRow(date, {
    raidName: '무너진 성자 미카엘라',
    modeName: '미카엘라 : 종언서(하드)',
    hard: true,
    ...extra
  })
const michaelaNormal = (date: string, extra: RaidData = {}) =>
  raidRow(date, { raidName: '무너진 성자 미카엘라', modeName: '미카엘라 : 종언서', ...extra })
const michaelaMatching = (date: string) =>
  raidRow(date, { raidName: '무너진 성자 미카엘라', modeName: '미카엘라 : 균열서' })
const diregieHard = (date: string) =>
  raidRow(date, { raidName: '디레지에 레이드', modeName: '디레지에 : 악연', hard: true })
const nabelHard = (date: string) =>
  raidRow(date, { raidName: '만들어진 신 나벨', modeName: '무지의 악', hard: true })
const legionRow = (date: string): NeopleTimelineRow => ({
  code: 209,
  name: '레기온',
  date,
  data: { regionName: '베누스' }
})
const boxRow = (date: string, itemId: string, itemName: string): NeopleTimelineRow => ({
  code: 504,
  name: '아이템 획득(항아리&상자)',
  date,
  data: { itemId, itemName, itemRarity: '레전더리', channelName: '합성 채널', channelNo: 7 }
})
const nightmareTitle = (date: string) => boxRow(date, NIGHTMARE_TITLE_ID, '황혼의 악연을 끊은 자')
const otherBox = (date: string) => boxRow(date, 'fixture-item-box', '합성 상자 아이템')

// 합성 캐릭터다.
const character = (characterId: string, fame = 120_000): ClearPopulationCharacter => ({
  serverId: 'cain',
  characterId,
  fame,
  jobId: 'job',
  jobGrowId: 'grow',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터'
})

const fromQueryDate = (text: string) =>
  at(
    `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T${text.slice(9, 11)}:${text.slice(11, 13)}`
  )
const fromRowDate = (text: string) => at(text.replace(' ', 'T'))

type TimelineRequest = { characterId: string; code: string; startDate: string; endDate: string }

// Neople처럼 요청한 code와 구간(분 단위, 끝 포함)의 기록만 돌려주는 가짜 client다.
function fakeNeople(
  timelines: Record<string, NeopleTimelineRow[]>,
  fail: (
    request: TimelineRequest,
    requests: readonly TimelineRequest[]
  ) => Error | undefined = () => undefined
) {
  const requests: TimelineRequest[] = []
  const neople: Pick<NeopleClient, 'characterTimeline'> = {
    characterTimeline: async ({ characterId }, query) => {
      if ('next' in query) {
        throw new Error('A page token was not issued')
      }
      const request = {
        characterId,
        code: query.code,
        startDate: query.startDate,
        endDate: query.endDate
      }
      const failure = fail(request, requests)
      requests.push(request)
      if (failure !== undefined) {
        throw failure
      }
      const codes = query.code.split(',').map(Number)
      const start = fromQueryDate(query.startDate)
      const end = fromQueryDate(query.endDate)
      const rows = (timelines[characterId] ?? []).filter((row) => {
        const occurredAt = fromRowDate(row.date)

        return codes.includes(row.code) && occurredAt >= start && occurredAt <= end
      })

      return { timeline: { rows, next: null } }
    }
  }

  return { neople, requests }
}

const populationKey = ({ contentId, weekStart }: { contentId: string; weekStart: Date }) =>
  JSON.stringify([contentId, weekStart.getTime()])
const clearKey = (clear: ContentClearInput) =>
  JSON.stringify([
    clear.contentId,
    clear.serverId,
    clear.characterId,
    clear.kind === 'raid' ? clear.weekStart.getTime() : null
  ])

// 저장 함수의 규칙(레이드는 주마다, 챌린지는 캐릭터당 가장 이른 클리어 한 행, 마감한 주의 모집단은 바꾸지 않음)을 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryClearStore(
  population: ClearPopulationCharacter[],
  seeded: StoredClearPopulation[] = []
) {
  const state = {
    population,
    populations: new Map(seeded.map((stored) => [populationKey(stored), stored])),
    clears: new Map<string, ContentClearInput>(),
    progress: undefined as ContentClearCollectionProgress | undefined
  }
  const store: ClearCollectionStore = {
    readPopulation: async () => [...state.population],
    readPopulations: async () => [...state.populations.values()],
    readProgress: async () => (state.progress === undefined ? undefined : { ...state.progress }),
    startProgress: async (startedAt) => {
      state.progress = { startedAt, done: 0 }
    },
    recordProgress: async (progress) => {
      state.progress = { ...progress }
    },
    recordClears: async (clears) => {
      for (const clear of clears) {
        const stored = state.clears.get(clearKey(clear))
        if (stored === undefined || stored.clearedAt > clear.clearedAt) {
          state.clears.set(clearKey(clear), clear)
        }
      }
    },
    recordPopulation: async (input) => {
      if (state.populations.get(populationKey(input))?.closed) {
        return
      }
      state.populations.set(populationKey(input), { ...input, jobs: [...input.jobs] })
    },
    finishProgress: async () => {
      state.progress = undefined
    }
  }

  return { state, store }
}

// 레이드의 출시 첫 주를 이미 채운 상태다. 챌린지의 첫 주는 지금 주라 하루 수집이 받는다.
const filledRaidFirstWeeks = (): StoredClearPopulation[] =>
  CLEAR_CONTENTS.filter(({ kind }) => kind === 'raid').map(({ id, releasedAt }) => ({
    contentId: id,
    weekStart: startOfResetWeek(releasedAt),
    population: 1,
    minFame: 120_000,
    jobs: [],
    collectedAt: at('2026-11-01T06:00'),
    closed: true
  }))

function collect(
  store: ClearCollectionStore,
  neople: Pick<NeopleClient, 'characterTimeline'>,
  now: Date,
  pauses: number[] = []
) {
  return collectContentClears({
    store,
    neople,
    concurrency: 1,
    now: () => now,
    pause: async (ms) => {
      pauses.push(ms)
    },
    report: () => {},
    reportProgress: () => {}
  })
}

const storedClears = (state: ReturnType<typeof memoryClearStore>['state']) =>
  [...state.clears.values()]
    .map(
      ({ contentId, characterId, weekStart, ratio }) =>
        `${contentId}/${characterId}/${weekStart.toISOString()}/${ratio}`
    )
    .sort()

const populationsOf = (state: ReturnType<typeof memoryClearStore>['state'], weekStart: Date) =>
  [...state.populations.values()]
    .filter((stored) => stored.weekStart.getTime() === weekStart.getTime())
    .map(({ contentId, population, closed }) => `${contentId}/${population}/${closed}`)
    .sort()

test('한 번 돌면 모집단 캐릭터마다 code 201, 210, 504로 지금 주를 한 번씩 요청하고 집계 대상 기록만 저장한다', async () => {
  const { state, store } = memoryClearStore(
    [character('a', 130_000), character('b', 125_000), character('c', 121_000)],
    filledRaidFirstWeeks()
  )
  const { neople, requests } = fakeNeople({
    a: [
      michaelaHard('2026-11-07 21:15'),
      michaelaMatching('2026-11-07 22:00'),
      diregieHard('2026-11-08 20:00'),
      legionRow('2026-11-08 21:00'),
      nightmareTitle('2026-11-06 23:59'),
      otherBox('2026-11-06 23:00')
    ],
    b: [michaelaNormal('2026-11-09 10:00', { ratio: 50 })]
  })

  const summary = await collect(store, neople, NOW)

  assert.deepEqual(requests, [
    { characterId: 'a', code: '201,210,504', startDate: '20261105T0600', endDate: '20261110T1200' },
    { characterId: 'b', code: '201,210,504', startDate: '20261105T0600', endDate: '20261110T1200' },
    { characterId: 'c', code: '201,210,504', startDate: '20261105T0600', endDate: '20261110T1200' }
  ])
  const week = CURRENT_WEEK.toISOString()
  assert.deepEqual(storedClears(state), [
    `engraved-nightmare-1/a/${week}/null`,
    `michaela-hard/a/${week}/null`,
    `michaela-normal/b/${week}/50`
  ])
  assert.deepEqual(populationsOf(state, CURRENT_WEEK), [
    'engraved-nightmare-1/3/false',
    'michaela-hard/3/false',
    'michaela-normal/3/false'
  ])
  const stored = state.populations.get(
    populationKey({ contentId: 'michaela-hard', weekStart: CURRENT_WEEK })
  )
  assert.equal(stored?.minFame, 121_000)
  assert.deepEqual(stored?.jobs, [
    {
      jobId: 'job',
      jobGrowId: 'grow',
      jobName: '귀검사(남)',
      jobGrowName: '眞 웨펀마스터',
      count: 3
    }
  ])
  assert.deepEqual(summary, {
    startedAt: NOW.toISOString(),
    characters: 3,
    requests: 3,
    clears: 3,
    skipped: 0
  })
  assert.equal(state.progress, undefined)
})

test('수집 도중 끝난 뒤 다시 돌면 처음 시작 시각의 구간으로 남은 캐릭터만 받는다', async () => {
  const memory = memoryClearStore(
    ['a', 'b', 'c', 'd'].map((id) => character(id)),
    filledRaidFirstWeeks()
  )
  const { state } = memory
  let stopped = false
  const store: ClearCollectionStore = {
    ...memory.store,
    recordClears: async (clears) => {
      if (!stopped && clears.some(({ characterId }) => characterId === 'c')) {
        stopped = true
        throw new Error('worker stopped')
      }

      await memory.store.recordClears(clears)
    }
  }
  const { neople, requests } = fakeNeople({
    c: [michaelaHard('2026-11-07 21:15')],
    d: [michaelaHard('2026-11-08 21:15')]
  })

  await assert.rejects(collect(store, neople, NOW), { message: 'worker stopped' })
  await collect(store, neople, at('2026-11-10T18:00'))

  assert.deepEqual(
    requests.map(({ characterId, endDate }) => `${characterId}/${endDate}`),
    ['a/20261110T1200', 'b/20261110T1200', 'c/20261110T1200', 'c/20261110T1200', 'd/20261110T1200']
  )
  assert.deepEqual(
    storedClears(state).map((clear) => clear.split('/').slice(0, 2).join('/')),
    ['michaela-hard/c', 'michaela-hard/d']
  )
  assert.deepEqual(populationsOf(state, CURRENT_WEEK), [
    'engraved-nightmare-1/4/false',
    'michaela-hard/4/false',
    'michaela-normal/4/false'
  ])
  assert.equal(state.progress, undefined)
})

test('같은 날 06:00 뒤에 성공한 수집은 다음 06:00이 지나야 보충 대상이 된다', async () => {
  const { store } = memoryClearStore([])
  const job = createContentClearCollectionJob(store, {
    neople: fakeNeople({}).neople,
    concurrency: 1,
    report: () => {}
  })
  const unused = async () => {
    throw new Error('not used')
  }
  const jobStore: JobStore = {
    registerJobs: unused,
    interruptRunningRuns: unused,
    isPaused: async () => false,
    readLastScheduledSuccess: async () => at('2026-11-10T06:00'),
    startRun: unused,
    claimRequestedRun: unused,
    recordProgress: unused,
    finishRun: unused,
    recordNextRun: unused,
    recordWorkerSeen: unused
  }
  const dueAt = async (now: Date) =>
    (await findCatchupJobs({ jobs: [job], store: jobStore, report: () => {} }, now)).map(
      ({ name }) => name
    )

  assert.deepEqual(await dueAt(at('2026-11-10T23:00')), [])
  assert.deepEqual(await dueAt(at('2026-11-11T05:30')), [])
  assert.deepEqual(await dueAt(at('2026-11-11T06:30')), ['content-clear-collection'])
})

test('목요일 06:00 뒤 첫 수집은 지난주 끝까지 받아 그 주를 마감하고, 마감한 주는 다음 수집이 바꾸지 않는다', async () => {
  const lastWeek = CURRENT_WEEK
  const thisWeek = at('2026-11-12T06:00')
  const memory = memoryClearStore([character('a'), character('b')], filledRaidFirstWeeks())
  const timelines: Record<string, NeopleTimelineRow[]> = {
    a: [michaelaHard('2026-11-07 21:15')],
    b: [michaelaHard('2026-11-11 23:00'), michaelaNormal('2026-11-12 06:30')]
  }
  const { neople, requests } = fakeNeople(timelines)

  await collect(memory.store, neople, at('2026-11-11T20:00'))
  await collect(memory.store, neople, at('2026-11-12T07:00'))
  const closedClears = storedClears(memory.state)
  memory.state.population = [character('a'), character('b'), character('c')]
  timelines.c = [michaelaHard('2026-11-10 21:00'), michaelaHard('2026-11-12 21:00')]
  await collect(memory.store, neople, at('2026-11-13T07:00'))

  assert.deepEqual(
    requests.map(({ characterId, startDate, endDate }) => `${characterId}/${startDate}/${endDate}`),
    [
      'a/20261105T0600/20261111T2000',
      'b/20261105T0600/20261111T2000',
      'a/20261105T0600/20261112T0700',
      'b/20261105T0600/20261112T0700',
      'a/20261112T0600/20261113T0700',
      'b/20261112T0600/20261113T0700',
      'c/20261112T0600/20261113T0700'
    ]
  )
  assert.deepEqual(populationsOf(memory.state, lastWeek), [
    'engraved-nightmare-1/2/true',
    'michaela-hard/2/true',
    'michaela-normal/2/true'
  ])
  assert.deepEqual(populationsOf(memory.state, thisWeek), [
    'engraved-nightmare-1/3/false',
    'michaela-hard/3/false',
    'michaela-normal/3/false'
  ])
  const lastWeekClears = (clears: string[]) =>
    clears.filter((clear) => clear.includes(lastWeek.toISOString()))
  assert.deepEqual(lastWeekClears(storedClears(memory.state)), lastWeekClears(closedClears))
  assert.deepEqual(lastWeekClears(closedClears), [
    `michaela-hard/a/${lastWeek.toISOString()}/null`,
    `michaela-hard/b/${lastWeek.toISOString()}/null`
  ])
})

test('출시 첫 주를 채우지 않은 컨텐츠는 첫 주 구간만 한 번 받고, 다른 컨텐츠의 기록은 그 구간에서 저장하지 않는다', async () => {
  const { state, store } = memoryClearStore([character('a')])
  const { neople, requests } = fakeNeople({
    a: [
      nabelHard('2025-04-18 21:00'),
      nabelHard('2025-05-01 21:00'),
      nabelHard('2026-02-06 20:00'),
      diregieHard('2026-02-06 21:00'),
      michaelaHard('2026-08-07 21:00'),
      michaelaHard('2026-08-20 21:00')
    ]
  })

  await collect(store, neople, NOW)
  const firstRequests = requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`)
  requests.length = 0
  await collect(store, neople, at('2026-11-11T12:00'))

  assert.deepEqual(firstRequests, [
    '20250417T0600/20250424T0559',
    '20250821T0600/20250828T0559',
    '20251204T0600/20251211T0559',
    '20260205T0600/20260212T0559',
    '20260806T0600/20260813T0559',
    '20261105T0600/20261110T1200'
  ])
  assert.deepEqual(
    requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`),
    ['20261105T0600/20261111T1200']
  )
  assert.deepEqual(storedClears(state), [
    `diregie-hard/a/${at('2026-02-05T06:00').toISOString()}/null`,
    `michaela-hard/a/${at('2026-08-06T06:00').toISOString()}/null`,
    `nabel-hard/a/${at('2025-04-17T06:00').toISOString()}/null`
  ])
  assert.deepEqual(populationsOf(state, at('2025-04-17T06:00')), [
    'nabel-hard/1/true',
    'nabel-normal/1/true'
  ])
  assert.deepEqual(populationsOf(state, at('2026-08-06T06:00')), [
    'michaela-hard/1/true',
    'michaela-normal/1/true'
  ])
})

test('새 컨텐츠에 밀려난 컨텐츠는 마감하지 않은 주만 끝까지 받아 마감하고 그 뒤 기록은 받지 않는다', async () => {
  const displacedWeek = at('2026-07-30T06:00')
  const openDiregieWeeks = ['diregie-normal', 'diregie-hard'].map((contentId) => ({
    contentId,
    weekStart: displacedWeek,
    population: 1,
    minFame: 120_000,
    jobs: [],
    collectedAt: at('2026-08-04T06:00'),
    closed: false
  }))
  const { state, store } = memoryClearStore(
    [character('a')],
    [...filledRaidFirstWeeks(), ...openDiregieWeeks]
  )
  const { neople, requests } = fakeNeople({
    a: [diregieHard('2026-08-05 21:00'), diregieHard('2026-08-07 21:00')]
  })

  await collect(store, neople, NOW)
  const firstRequests = requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`)
  requests.length = 0
  await collect(store, neople, at('2026-11-11T12:00'))

  assert.deepEqual(firstRequests, ['20260730T0600/20260806T0559', '20261105T0600/20261110T1200'])
  assert.deepEqual(
    requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`),
    ['20261105T0600/20261111T1200']
  )
  assert.deepEqual(populationsOf(state, displacedWeek), [
    'diregie-hard/1/true',
    'diregie-normal/1/true'
  ])
  assert.deepEqual(
    storedClears(state).filter((clear) => clear.startsWith('diregie')),
    [`diregie-hard/a/${displacedWeek.toISOString()}/null`]
  )
})

test('Neople 한도 초과면 쉬었다가 같은 캐릭터를 다시 받고, Neople에 없는 캐릭터는 건너뛴다', async () => {
  const { state, store } = memoryClearStore(
    [character('a'), character('missing'), character('b')],
    filledRaidFirstWeeks()
  )
  const { neople, requests } = fakeNeople(
    { a: [michaelaHard('2026-11-07 21:15')], b: [michaelaHard('2026-11-08 21:15')] },
    (request, previous) => {
      if (request.characterId === 'missing') {
        return new NeopleRequestFailure('api', { characterNotFound: true })
      }

      if (request.characterId === 'a' && previous.length === 0) {
        return new NeopleRequestFailure('unavailable')
      }

      return undefined
    }
  )
  const pauses: number[] = []

  const summary = await collect(store, neople, NOW, pauses)

  assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS])
  assert.deepEqual(
    requests.map(({ characterId }) => characterId),
    ['a', 'a', 'missing', 'b']
  )
  assert.deepEqual(
    storedClears(state).map((clear) => clear.split('/').slice(0, 2).join('/')),
    ['michaela-hard/a', 'michaela-hard/b']
  )
  assert.deepEqual(populationsOf(state, CURRENT_WEEK), [
    'engraved-nightmare-1/3/false',
    'michaela-hard/3/false',
    'michaela-normal/3/false'
  ])
  assert.deepEqual(summary, {
    startedAt: NOW.toISOString(),
    characters: 3,
    requests: 4,
    clears: 2,
    skipped: 1
  })
})

test('새 캐릭터 대기열이 차 있는 동안에도 클리어 수집 요청이 함께 나가고, 두 작업의 요청을 합쳐도 초당 상한을 넘지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const requestsPerSecond = 5
  const calls: { kind: 'basic' | 'timeline'; at: number }[] = []
  const neople = paceNeopleRequests(
    {
      characterBasic: async ({ serverId, characterId }) => {
        calls.push({ kind: 'basic', at: Date.now() })

        return {
          serverId,
          characterId,
          characterName: `이름-${characterId}`,
          adventureName: '모험단',
          level: 115,
          jobId: 'job',
          jobGrowId: 'grow',
          jobName: '귀검사(남)',
          jobGrowName: '眞 웨펀마스터',
          fame: 60_000,
          guildId: null,
          guildName: null
        }
      },
      characterSkillStyle: async () => {
        throw new Error('이 테스트는 스킬 스타일을 부르지 않는다')
      },
      characterTimeline: async () => {
        calls.push({ kind: 'timeline', at: Date.now() })

        return { timeline: { rows: [], next: null } }
      }
    },
    requestsPerSecond
  )
  let queueOpen = true
  let queued = 0
  const collectionStore: CollectionStore = {
    takeBatch: async (): Promise<CollectedCharacter[]> =>
      queueOpen ? [{ serverId: 'cain', characterId: `queued-${queued++}` }] : [],
    recordBasic: async () => {},
    recordFailure: async () => {}
  }
  const settled = { collection: false, clears: false }
  const collection = runCollectionPass({
    importFiles: [],
    importedAt: new Map(),
    enqueue: async () => {},
    fetchBasic: createNeopleCharacterBasic(neople),
    store: collectionStore,
    concurrency: 1,
    report: () => {}
  }).finally(() => {
    settled.collection = true
  })
  const { store } = memoryClearStore(
    ['a', 'b', 'c', 'd'].map((id) => character(id)),
    filledRaidFirstWeeks()
  )
  const clears = collect(store, neople, NOW).finally(() => {
    settled.clears = true
  })
  // 지연 없는 timer도 tick이 있어야 돌므로, 지금 시각의 timer를 먼저 돌린 뒤 시계를 넘긴다.
  const advanceUntil = async (done: () => boolean) => {
    for (let step = 0; step < 10_000 && !done(); step++) {
      t.mock.timers.tick(0)
      await setImmediate()
      t.mock.timers.tick(10)
      await setImmediate()
    }
  }

  await advanceUntil(() => settled.clears)
  queueOpen = false
  await advanceUntil(() => settled.collection)
  await Promise.all([collection, clears])

  assert.equal(calls.filter(({ kind }) => kind === 'timeline').length, 4)
  const lastTimeline = calls.findLastIndex(({ kind }) => kind === 'timeline')
  assert.ok(calls.slice(0, lastTimeline).filter(({ kind }) => kind === 'basic').length >= 3)
  for (const { at: start } of calls) {
    const inSecond = calls.filter(({ at: time }) => time >= start && time < start + 1000)
    assert.ok(inSecond.length <= requestsPerSecond)
  }
})
