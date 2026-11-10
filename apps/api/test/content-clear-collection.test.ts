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
import { addWeeks } from 'date-fns'
import { createJobSchedule } from '../src/infrastructure/jobs/scheduler.js'
import { createNeopleClearTimeline } from '../src/infrastructure/neople/content-clear-collection.js'
import {
  createNeopleCharacterBasic,
  paceNeopleRequests
} from '../src/character-collection/adapters.js'
import type { CollectionStore } from '../src/character-collection/collect.js'
import { runCollectionPass } from '../src/character-collection/runner.js'
import { createContentClearCollectionJob } from '../src/application/content-clears/collection-job.js'
import {
  type ClearCollectionStore,
  type ClearStatsReader
} from '../src/application/content-clears/ports.js'
import {
  UNAVAILABLE_PAUSE_MS,
  collectContentClears
} from '../src/application/content-clears/collection.js'
import { CLEAR_CONTENTS } from '../src/domain/content-clears/contents.js'
import { createClearStatsService } from '../src/application/content-clears/service.js'
import type { JobStore } from '../src/application/jobs/ports.js'
import { findCatchupJobs } from '../src/application/jobs/scheduler.js'
import { formatResetDate, startOfResetWeek } from '../src/domain/seoul-time.js'

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
const character = (characterId: string, maxFame = 120_000): ClearPopulationCharacter => ({
  serverId: 'cain',
  characterId,
  maxFame,
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
    populationMinFames: [] as number[],
    populations: new Map(seeded.map((stored) => [populationKey(stored), stored])),
    clears: new Map<string, ContentClearInput>(),
    progress: undefined as ContentClearCollectionProgress | undefined
  }
  const store: ClearCollectionStore = {
    readPopulation: async (minMaxFame) => {
      state.populationMinFames.push(minMaxFame)

      return state.population.filter(({ maxFame }) => maxFame >= minMaxFame)
    },
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

const storedPopulation = (
  contentId: string,
  weekStart: Date,
  closed = true
): StoredClearPopulation => ({
  contentId,
  weekStart,
  population: 1,
  minFame: 120_000,
  jobs: [],
  collectedAt: at('2026-11-01T06:00'),
  closed
})

const weeksBefore = (first: Date, end: Date) => {
  const weeks: Date[] = []
  for (let week = first; week < end; week = addWeeks(week, 1)) {
    weeks.push(week)
  }

  return weeks
}

// 운영 DB처럼 레이드마다 출시 첫 주만 마감해 저장한 상태다.
const raidFirstWeeks = (): StoredClearPopulation[] =>
  CLEAR_CONTENTS.filter(({ kind }) => kind === 'raid').map(({ id, releasedAt }) =>
    storedPopulation(id, startOfResetWeek(releasedAt))
  )

// 지난 주를 모두 마감한 상태다. 챌린지의 출시 주는 지금 주라 마감한 주가 없다.
const closedPastWeeks = (): StoredClearPopulation[] =>
  CLEAR_CONTENTS.flatMap(({ id, releasedAt }) =>
    weeksBefore(startOfResetWeek(releasedAt), CURRENT_WEEK).map((week) =>
      storedPopulation(id, week)
    )
  )

function collect(
  store: ClearCollectionStore,
  neople: Pick<NeopleClient, 'characterTimeline'>,
  now: Date,
  pauses: number[] = []
) {
  return collectContentClears({
    store,
    createFetchTimeline: createNeopleClearTimeline(neople),
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

const everyContent = (population: number, closed: boolean) =>
  CLEAR_CONTENTS.map(({ id }) => `${id}/${population}/${closed}`).sort()

test('한 번 돌면 모집단 캐릭터마다 code 201, 210, 504로 지금 주를 한 번씩 요청하고 집계 대상 기록만 저장한다', async () => {
  const { state, store } = memoryClearStore(
    [character('a', 130_000), character('b', 125_000), character('c', 121_000)],
    closedPastWeeks()
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
    `diregie-hard/a/${week}/null`,
    `engraved-nightmare-1/a/${week}/null`,
    `michaela-hard/a/${week}/null`,
    `michaela-normal/b/${week}/50`
  ])
  assert.deepEqual(populationsOf(state, CURRENT_WEEK), everyContent(3, false))
  const stored = state.populations.get(
    populationKey({ contentId: 'michaela-hard', weekStart: CURRENT_WEEK })
  )
  assert.equal(stored?.minFame, 104_292)
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
    clears: 4,
    skipped: 0
  })
  assert.equal(state.progress, undefined)
})

const BACKFILL_RANGES = [
  '20250424T0600/20250722T0559',
  '20250722T0600/20251019T0559',
  '20251019T0600/20260116T0559',
  '20260116T0600/20260415T0559',
  '20260415T0600/20260713T0559',
  '20260713T0600/20261010T0559'
]

test('거슬러 받는 수집이 도중에 끝나면 주가 바뀐 뒤 다시 돌아도 처음 시작 시각의 구간과 마감 기준으로 남은 캐릭터만 받는다', async () => {
  const memory = memoryClearStore(
    ['a', 'b', 'c', 'd'].map((id) => character(id)),
    raidFirstWeeks()
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
    c: [nabelHard('2025-06-05 21:00'), michaelaHard('2026-11-07 21:15')],
    d: [michaelaHard('2026-11-08 21:15'), michaelaHard('2026-11-11 23:00')]
  })

  await assert.rejects(collect(store, neople, at('2026-11-11T20:00')), {
    message: 'worker stopped'
  })
  await collect(store, neople, at('2026-11-12T07:00'))

  const ranges = [...BACKFILL_RANGES, '20261010T0600/20261111T2000']
  const rangesOf = (characterId: string) =>
    requests
      .filter((request) => request.characterId === characterId)
      .map(({ startDate, endDate }) => `${startDate}/${endDate}`)
  assert.deepEqual(rangesOf('a'), ranges)
  assert.deepEqual(rangesOf('b'), ranges)
  assert.deepEqual(rangesOf('c'), [...ranges, ...ranges])
  assert.deepEqual(rangesOf('d'), ranges)
  assert.deepEqual(storedClears(state), [
    `michaela-hard/c/${CURRENT_WEEK.toISOString()}/null`,
    `michaela-hard/d/${CURRENT_WEEK.toISOString()}/null`,
    `nabel-hard/c/${at('2025-06-05T06:00').toISOString()}/null`
  ])
  assert.deepEqual(populationsOf(state, at('2026-10-29T06:00')), [
    'diregie-hard/4/true',
    'diregie-normal/4/true',
    'inae-twilight/4/true',
    'michaela-hard/4/true',
    'michaela-normal/4/true',
    'nabel-hard/4/true',
    'nabel-normal/4/true'
  ])
  assert.deepEqual(populationsOf(state, CURRENT_WEEK), everyContent(4, false))
  assert.deepEqual(populationsOf(state, at('2026-11-12T06:00')), [])
  assert.equal(state.progress, undefined)
})

test('최고 명성 104,292 이상을 모두 받고, 각인된 악몽의 분모는 119,414 이상, 레이드 7개 항목의 분모는 수집 대상 전체이며 직업별 수도 같은 기준이다', async () => {
  const other = (characterId: string, maxFame: number): ClearPopulationCharacter => ({
    ...character(characterId, maxFame),
    jobGrowId: 'other-grow',
    jobGrowName: '眞 소드마스터'
  })
  const { state, store } = memoryClearStore(
    [
      character('a', 130_000),
      other('b', 119_414),
      other('c', 119_413),
      character('d', 104_292),
      character('e', 104_291)
    ],
    closedPastWeeks()
  )
  const { neople, requests } = fakeNeople({})

  await collect(store, neople, NOW)

  assert.deepEqual(state.populationMinFames, [104_292])
  assert.deepEqual(
    requests.map(({ characterId }) => characterId),
    ['a', 'b', 'c', 'd']
  )
  const weekPopulation = (contentId: string) => {
    const stored = state.populations.get(populationKey({ contentId, weekStart: CURRENT_WEEK }))
    const jobs = stored?.jobs.map(({ jobGrowId, count }) => `${jobGrowId}/${count}`).sort()

    return { population: stored?.population, minFame: stored?.minFame, jobs }
  }
  assert.deepEqual(weekPopulation('engraved-nightmare-1'), {
    population: 2,
    minFame: 119_414,
    jobs: ['grow/1', 'other-grow/1']
  })
  for (const { id } of CLEAR_CONTENTS.filter(({ kind }) => kind === 'raid')) {
    assert.deepEqual(
      weekPopulation(id),
      { population: 4, minFame: 104_292, jobs: ['grow/2', 'other-grow/2'] },
      id
    )
  }
})

test('migration이 마감을 푼 상위 10만 주는 다음 수집이 새 분모 기준과 수로 덮어쓰고 마감한다', async () => {
  const reopened = closedPastWeeks().map((stored) => ({
    ...stored,
    population: 100_000,
    minFame: 125_871,
    closed: false
  }))
  const { state, store } = memoryClearStore(
    [character('a', 130_000), character('b', 110_000)],
    reopened
  )
  const { neople, requests } = fakeNeople({ b: [nabelHard('2025-06-05 21:00')] })

  await collect(store, neople, NOW)

  assert.deepEqual(
    requests
      .filter(({ characterId }) => characterId === 'a')
      .map(({ startDate, endDate }) => `${startDate}/${endDate}`),
    [
      '20250417T0600/20250715T0559',
      '20250715T0600/20251012T0559',
      '20251012T0600/20260109T0559',
      '20260109T0600/20260408T0559',
      '20260408T0600/20260706T0559',
      '20260706T0600/20261003T0559',
      '20261003T0600/20261110T1200'
    ]
  )
  assert.deepEqual(storedClears(state), [
    `nabel-hard/b/${at('2025-06-05T06:00').toISOString()}/null`
  ])
  for (const { contentId, weekStart } of reopened) {
    const stored = state.populations.get(populationKey({ contentId, weekStart }))
    assert.deepEqual(
      [stored?.population, stored?.minFame, stored?.closed],
      [2, 104_292, true],
      `${contentId}/${formatResetDate(weekStart)}`
    )
  }
})

test('같은 날 06:00 뒤에 성공한 수집은 다음 06:00이 지나야 보충 대상이 된다', async () => {
  const { store } = memoryClearStore([])
  const job = createContentClearCollectionJob(store, {
    createFetchTimeline: createNeopleClearTimeline(fakeNeople({}).neople),
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
    (
      await findCatchupJobs(
        { jobs: [job], store: jobStore, report: () => {} },
        now,
        createJobSchedule
      )
    ).map(({ name }) => name)

  assert.deepEqual(await dueAt(at('2026-11-10T23:00')), [])
  assert.deepEqual(await dueAt(at('2026-11-11T05:30')), [])
  assert.deepEqual(await dueAt(at('2026-11-11T06:30')), ['content-clear-collection'])
})

test('목요일 06:00 뒤 첫 수집은 지난주 끝까지 받아 그 주를 마감하고, 마감한 주는 다음 수집이 바꾸지 않는다', async () => {
  const lastWeek = CURRENT_WEEK
  const thisWeek = at('2026-11-12T06:00')
  const memory = memoryClearStore([character('a'), character('b')], closedPastWeeks())
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
  assert.deepEqual(populationsOf(memory.state, lastWeek), everyContent(2, true))
  assert.deepEqual(populationsOf(memory.state, thisWeek), everyContent(3, false))
  const lastWeekClears = (clears: string[]) =>
    clears.filter((clear) => clear.includes(lastWeek.toISOString()))
  assert.deepEqual(lastWeekClears(storedClears(memory.state)), lastWeekClears(closedClears))
  assert.deepEqual(lastWeekClears(closedClears), [
    `michaela-hard/a/${lastWeek.toISOString()}/null`,
    `michaela-hard/b/${lastWeek.toISOString()}/null`
  ])
})

test('출시 첫 주와 지금 주만 저장한 레이드는 그 사이 모든 주를 받아 지난 주를 마감하고, 마감한 출시 첫 주는 바꾸지 않으며, 집계 목록이 빈 주 없이 준다', async () => {
  const seeded = [
    ...raidFirstWeeks(),
    ...raidFirstWeeks().map(({ contentId }) => storedPopulation(contentId, CURRENT_WEEK, false))
  ]
  const { state, store } = memoryClearStore([character('a')], seeded)
  const { neople, requests } = fakeNeople({
    a: [
      nabelHard('2025-04-18 21:00'),
      nabelHard('2025-05-01 21:00'),
      diregieHard('2026-02-06 21:00'),
      diregieHard('2026-02-13 21:00'),
      michaelaHard('2026-08-07 21:00'),
      michaelaHard('2026-08-20 21:00'),
      michaelaHard('2026-11-07 21:00')
    ]
  })

  await collect(store, neople, NOW)
  const firstRequests = requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`)
  requests.length = 0
  await collect(store, neople, at('2026-11-11T12:00'))

  assert.deepEqual(firstRequests, [...BACKFILL_RANGES, '20261010T0600/20261110T1200'])
  assert.deepEqual(
    requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`),
    ['20261105T0600/20261111T1200']
  )
  assert.deepEqual(storedClears(state), [
    `diregie-hard/a/${at('2026-02-12T06:00').toISOString()}/null`,
    `michaela-hard/a/${at('2026-08-20T06:00').toISOString()}/null`,
    `michaela-hard/a/${CURRENT_WEEK.toISOString()}/null`,
    `nabel-hard/a/${at('2025-05-01T06:00').toISOString()}/null`
  ])
  for (const first of raidFirstWeeks()) {
    assert.deepEqual(state.populations.get(populationKey(first)), first)
  }
  assert.deepEqual(populationsOf(state, at('2025-10-30T06:00')), [
    'inae-twilight/1/true',
    'nabel-hard/1/true',
    'nabel-normal/1/true'
  ])
  assert.deepEqual(populationsOf(state, CURRENT_WEEK), everyContent(1, false))

  const reader: ClearStatsReader = {
    readCollectedAt: async () => NOW,
    readPopulations: async () => [...state.populations.values()],
    readWeekRatioCounts: async () => [],
    readJobCounts: async () => [],
    readAdventureSizes: async () => []
  }
  const { contents } = await createClearStatsService(reader).stats()
  for (const content of CLEAR_CONTENTS) {
    const releaseWeek = startOfResetWeek(content.releasedAt)
    const expected = [...weeksBefore(releaseWeek, CURRENT_WEEK), CURRENT_WEEK].map((week) =>
      formatResetDate(week)
    )
    assert.deepEqual(
      contents.find(({ id }) => id === content.id)?.weeks.map(({ weekStart }) => weekStart),
      expected,
      content.id
    )
  }
})

test('새 컨텐츠에 밀려난 레이드도 이번 주 클리어를 저장하고, 다음 주 첫 수집이 그 주를 마감한다', async () => {
  const nextWeek = at('2026-11-12T06:00')
  const { state, store } = memoryClearStore([character('a')], closedPastWeeks())
  const { neople, requests } = fakeNeople({
    a: [diregieHard('2026-11-08 21:00'), nabelHard('2026-11-12 21:00')]
  })

  await collect(store, neople, NOW)
  await collect(store, neople, at('2026-11-13T07:00'))

  assert.deepEqual(
    requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`),
    ['20261105T0600/20261110T1200', '20261105T0600/20261113T0700']
  )
  assert.deepEqual(storedClears(state), [
    `diregie-hard/a/${CURRENT_WEEK.toISOString()}/null`,
    `nabel-hard/a/${nextWeek.toISOString()}/null`
  ])
  assert.deepEqual(populationsOf(state, CURRENT_WEEK), everyContent(1, true))
  assert.deepEqual(populationsOf(state, nextWeek), everyContent(1, false))
})

test('Neople 한도 초과면 쉬었다가 같은 캐릭터를 다시 받고, Neople에 없는 캐릭터는 건너뛴다', async () => {
  const { state, store } = memoryClearStore(
    [character('a'), character('missing'), character('b')],
    closedPastWeeks()
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
  assert.deepEqual(populationsOf(state, CURRENT_WEEK), everyContent(3, false))
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
    closedPastWeeks()
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
