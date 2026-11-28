import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type {
  ClearPopulationCharacter,
  ClearPopulationJob,
  ClearPopulationSelection,
  ClearRecordBackfillProgress,
  ClearRecordCursor,
  ClearRecordInput,
  CollectedCharacter,
  ContentClearCollectionProgress,
  ContentClearInput,
  ContentClearSetting,
  StoredClearPopulation,
  TimelineCharacter
} from '@dfragon/database'
import { type NeopleClient, NeopleRequestFailure, type NeopleTimelineRow } from '@dfragon/neople'
import { addWeeks } from 'date-fns'
import { createJobSchedule } from '../src/infrastructure/jobs/scheduler.js'
import {
  createNeopleClearRecordTimeline,
  createNeopleClearTimeline
} from '../src/infrastructure/neople/content-clear-collection.js'
import {
  type WorkerNeople,
  createNeopleCharacterBasic
} from '../src/infrastructure/neople/character-collection.js'
import { pacePrioritizedNeopleRequests } from '../src/infrastructure/neople/request-priority.js'
import {
  type BatchNeopleKeyPool,
  createBatchNeopleKeyPool
} from '../src/infrastructure/neople/batch-key-pool.js'
import type { CollectionRepository } from '../src/application/character-collection/repository.js'
import {
  importCollectedCharacters,
  readImportModifiedTime
} from '../src/infrastructure/files/character-collection.js'
import { CharacterCollectionService } from '../src/application/character-collection/service.js'
import { createContentClearCollectionJob } from '../src/application/content-clears/collection-job.js'
import type {
  ClearCollectionRepository,
  ClearRecordBackfillRepository
} from '../src/application/content-clears/repository.js'
import { ContentClearCollectionService } from '../src/application/content-clears/collection.js'
import { UNAVAILABLE_PAUSE_MS } from '../src/application/content-clears/population-collection.js'
import { ClearRecordBackfillService } from '../src/application/content-clears/record-backfill.js'
import { CLEAR_CONTENTS } from '@dfragon/server-core/domain/content-clears/index.js'
import type { JobRepository } from '../src/application/jobs/repository.js'
import { JobSchedulerService } from '../src/application/jobs/scheduler.js'
import { formatResetDate, startOfResetWeek } from '@dfragon/server-core/domain/seoul-time.js'

const at = (time: string) => new Date(`${time}:00+09:00`)
const NOW = at('2026-11-10T12:00')
const LAST_WEEK = at('2026-11-05T06:00')
const COLLECTED_AT = at('2026-11-12T07:00')
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

const recordKey = (record: ClearRecordInput) =>
  JSON.stringify([
    record.serverId,
    record.characterId,
    record.clearedAt.getTime(),
    record.kind,
    record.name
  ])

const compareCharacters = (left: TimelineCharacter, right: TimelineCharacter) =>
  left.serverId.localeCompare(right.serverId) || left.characterId.localeCompare(right.characterId)

// 저장 함수의 규칙(수집 대상은 서버, 캐릭터 순, 레이드는 주마다, 챌린지는 캐릭터당 가장 이른 클리어 한 행, 마감한 주의 분모는 바꾸지 않음)을 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryClearStore(
  population: ClearPopulationCharacter[],
  seeded: StoredClearPopulation[] = [],
  inactiveIds: ReadonlySet<string> = new Set(),
  settings: ContentClearSetting[] = []
) {
  const state = {
    population,
    populationMinFames: [] as number[],
    populations: new Map(seeded.map((stored) => [populationKey(stored), stored])),
    clears: new Map<string, ContentClearInput>(),
    records: new Map<string, ClearRecordInput>(),
    lastActiveAt: new Map<string, Date>(),
    progress: undefined as ContentClearCollectionProgress | undefined
  }
  const selected = ({ minMaxFame, activity }: ClearPopulationSelection) =>
    state.population
      .filter(
        ({ characterId, maxFame }) =>
          maxFame >= minMaxFame &&
          (activity === 'include-inactive' || !inactiveIds.has(characterId))
      )
      .sort(compareCharacters)

  const store: ClearCollectionRepository = {
    readSettings: async () => settings,
    countPopulation: async (selection) => {
      state.populationMinFames.push(selection.minMaxFame)

      return selected(selection).length
    },
    readPopulationPage: async (selection, { after, skip, limit }) => {
      state.populationMinFames.push(selection.minMaxFame)

      return selected(selection)
        .filter((member) => after === undefined || compareCharacters(member, after) > 0)
        .slice(skip, skip + limit)
        .map(({ serverId, characterId }) => ({ serverId, characterId }))
    },
    readPopulationJobs: async (minMaxFame) => {
      const jobs = new Map<string, ClearPopulationJob>()
      for (const { maxFame, jobId, jobGrowId, jobName, jobGrowName } of state.population) {
        if (maxFame < minMaxFame) {
          continue
        }

        const key = JSON.stringify([jobId, jobGrowId])
        const job = jobs.get(key) ?? { jobId, jobGrowId, jobName, jobGrowName, count: 0 }
        jobs.set(key, { ...job, count: job.count + 1 })
      }

      return [...jobs.values()]
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
    recordRecords: async (records) => {
      for (const record of records) {
        if (!state.records.has(recordKey(record))) {
          state.records.set(recordKey(record), record)
        }
      }
    },
    recordActivities: async (activities) => {
      for (const { characterId, lastActiveAt } of activities) {
        const stored = state.lastActiveAt.get(characterId)

        if (stored === undefined || stored < lastActiveAt) {
          state.lastActiveAt.set(characterId, lastActiveAt)
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

// 지난주 전까지 모두 마감한 상태다. 챌린지의 출시 주는 지난주라 마감한 주가 없다.
const closedPastWeeks = (): StoredClearPopulation[] =>
  CLEAR_CONTENTS.flatMap(({ id, releasedAt }) =>
    weeksBefore(startOfResetWeek(releasedAt), LAST_WEEK).map((week) => storedPopulation(id, week))
  )

function collect(
  store: ClearCollectionRepository,
  neople: Pick<NeopleClient, 'characterTimeline'>,
  now: Date,
  pauses: number[] = []
) {
  return new ContentClearCollectionService(store, {
    createFetchTimeline: createNeopleClearTimeline(neople),
    readConcurrency: () => 1,
    now: () => now,
    pause: async (ms) => {
      pauses.push(ms)
    },
    report: () => {}
  }).collect(() => {})
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

test('한 번 돌면 수집 대상 캐릭터마다 code 201, 209, 210, 504로 끝난 지난주를 한 번씩 요청하고 집계 대상 기록만 클리어 집계에 저장한다', async () => {
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

  const summary = await collect(store, neople, COLLECTED_AT)

  assert.deepEqual(requests, [
    {
      characterId: 'a',
      code: '201,209,210,504',
      startDate: '20261105T0600',
      endDate: '20261112T0559'
    },
    {
      characterId: 'b',
      code: '201,209,210,504',
      startDate: '20261105T0600',
      endDate: '20261112T0559'
    },
    {
      characterId: 'c',
      code: '201,209,210,504',
      startDate: '20261105T0600',
      endDate: '20261112T0559'
    }
  ])
  const week = LAST_WEEK.toISOString()
  assert.deepEqual(storedClears(state), [
    `diregie-hard/a/${week}/null`,
    `engraved-nightmare-1/a/${week}/null`,
    `michaela-hard/a/${week}/null`,
    `michaela-normal/b/${week}/50`
  ])
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(3, true))
  const stored = state.populations.get(
    populationKey({ contentId: 'michaela-hard', weekStart: LAST_WEEK })
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
    startedAt: COLLECTED_AT.toISOString(),
    characters: 3,
    requests: 3,
    clears: 4,
    records: 5,
    skipped: 0
  })
  assert.equal(state.progress, undefined)
})

test('수집을 끈 컨텐츠는 클리어와 분모를 저장하지 않고, 수집 하한은 끈 컨텐츠의 입장 명성까지 그대로 둔다', async () => {
  const off = (contentId: string): ContentClearSetting => ({
    contentId,
    collected: false,
    shown: true,
    updatedAt: at('2026-11-10T10:00')
  })
  const { state, store } = memoryClearStore(
    [character('a', 130_000), character('b', 50_000)],
    closedPastWeeks(),
    new Set(),
    [off('michaela-hard'), off('nabel-normal'), off('nabel-hard')]
  )
  const { neople, requests } = fakeNeople({
    a: [michaelaHard('2026-11-07 21:15'), diregieHard('2026-11-08 20:00')]
  })

  await collect(store, neople, COLLECTED_AT)

  const week = LAST_WEEK.toISOString()
  assert.deepEqual(storedClears(state), [`diregie-hard/a/${week}/null`])
  assert.deepEqual(populationsOf(state, LAST_WEEK), [
    'diregie-hard/1/true',
    'diregie-normal/1/true',
    'engraved-nightmare-1/1/true',
    'inae-twilight/1/true',
    'michaela-normal/1/true'
  ])
  // 나벨 둘을 꺼도 하한이 나벨 입장 명성 47,684라 그보다 낮은 디레지에 하한으로 오르지 않고 b도 받는다.
  assert.deepEqual(
    requests.map(({ characterId }) => characterId),
    ['a', 'b']
  )
})

test('비활성 캐릭터는 Neople에 요청하지 않고 클리어가 없는 캐릭터로 분모에만 넣는다', async () => {
  const { state, store } = memoryClearStore(
    [character('a', 130_000), character('b', 125_000), character('c', 121_000)],
    closedPastWeeks(),
    new Set(['b'])
  )
  const { neople, requests } = fakeNeople({
    a: [michaelaHard('2026-11-07 21:15')],
    b: [michaelaHard('2026-11-07 22:00')]
  })

  const summary = await collect(store, neople, COLLECTED_AT)

  assert.deepEqual(
    requests.map(({ characterId }) => characterId),
    ['a', 'c']
  )
  const week = LAST_WEEK.toISOString()
  assert.deepEqual(storedClears(state), [`michaela-hard/a/${week}/null`])
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(3, true))
  assert.equal(summary.characters, 2)
})

test('받은 타임라인의 가장 최근 기록이 30일 안이면 그 시각을 캐릭터의 마지막 활동으로 기록하고, 더 오래된 기록만 있거나 기록이 없으면 기록하지 않는다', async () => {
  const { state, store } = memoryClearStore(
    [character('recent'), character('old'), character('empty')],
    raidFirstWeeks()
  )
  const { neople } = fakeNeople({
    recent: [
      michaelaHard('2026-11-07 21:15'),
      legionRow('2026-11-08 21:00'),
      nabelHard('2025-06-05 21:00')
    ],
    old: [nabelHard('2025-06-05 21:00')]
  })

  await collect(store, neople, COLLECTED_AT)

  assert.deepEqual([...state.lastActiveAt], [['recent', at('2026-11-08T21:00')]])
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
  const store: ClearCollectionRepository = {
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

  await assert.rejects(collect(store, neople, COLLECTED_AT), {
    message: 'worker stopped'
  })
  await collect(store, neople, at('2026-11-19T07:00'))

  const ranges = [...BACKFILL_RANGES, '20261010T0600/20261112T0559']
  const rangesOf = (characterId: string) =>
    requests
      .filter((request) => request.characterId === characterId)
      .map(({ startDate, endDate }) => `${startDate}/${endDate}`)

  assert.deepEqual(rangesOf('a'), ranges)
  assert.deepEqual(rangesOf('b'), ranges)
  assert.deepEqual(rangesOf('c'), [...ranges, ...ranges])
  assert.deepEqual(rangesOf('d'), ranges)
  assert.deepEqual(storedClears(state), [
    `michaela-hard/c/${LAST_WEEK.toISOString()}/null`,
    `michaela-hard/d/${LAST_WEEK.toISOString()}/null`,
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
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(4, true))
  assert.deepEqual(populationsOf(state, at('2026-11-12T06:00')), [])
  assert.equal(state.progress, undefined)
})

test('수집 대상이 한 번에 읽는 10,000명을 넘으면 읽은 캐릭터 다음부터 이어 읽어 모두 한 번씩 요청한다', async () => {
  const ids = Array.from({ length: 10_001 }, (_, index) => `c${String(index).padStart(5, '0')}`)
  const { state, store } = memoryClearStore(
    ids.map((id) => character(id)),
    closedPastWeeks()
  )
  const { neople, requests } = fakeNeople({ c10000: [michaelaHard('2026-11-07 21:15')] })

  const summary = await collect(store, neople, COLLECTED_AT)

  assert.deepEqual(
    requests.map(({ characterId }) => characterId),
    ids
  )
  assert.equal(summary.characters, 10_001)
  assert.deepEqual(
    storedClears(state).map((clear) => clear.split('/').slice(0, 2).join('/')),
    ['michaela-hard/c10000']
  )
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(10_001, true))
})

test('최고 명성 47,684 이상을 모두 받고, 분모와 직업별 수는 컨텐츠마다 그 입장 명성 이상인 캐릭터로 센다', async () => {
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
      character('e', 72_688),
      character('f', 63_257),
      character('g', 47_684),
      character('h', 47_683)
    ],
    closedPastWeeks()
  )
  const { neople, requests } = fakeNeople({})

  await collect(store, neople, COLLECTED_AT)

  assert.deepEqual(new Set(state.populationMinFames), new Set([47_684]))
  assert.deepEqual(
    requests.map(({ characterId }) => characterId),
    ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  )
  const weekPopulation = (contentId: string) => {
    const stored = state.populations.get(populationKey({ contentId, weekStart: LAST_WEEK }))
    const jobs = stored?.jobs.map(({ jobGrowId, count }) => `${jobGrowId}/${count}`).sort()

    return { population: stored?.population, minFame: stored?.minFame, jobs }
  }
  const expected = {
    'engraved-nightmare-1': { population: 2, minFame: 119_414, jobs: ['grow/1', 'other-grow/1'] },
    'michaela-normal': { population: 4, minFame: 104_292, jobs: ['grow/2', 'other-grow/2'] },
    'michaela-hard': { population: 4, minFame: 104_292, jobs: ['grow/2', 'other-grow/2'] },
    'inae-twilight': { population: 5, minFame: 72_688, jobs: ['grow/3', 'other-grow/2'] },
    'diregie-normal': { population: 6, minFame: 63_257, jobs: ['grow/4', 'other-grow/2'] },
    'diregie-hard': { population: 6, minFame: 63_257, jobs: ['grow/4', 'other-grow/2'] },
    'nabel-normal': { population: 7, minFame: 47_684, jobs: ['grow/5', 'other-grow/2'] },
    'nabel-hard': { population: 7, minFame: 47_684, jobs: ['grow/5', 'other-grow/2'] }
  }
  for (const [contentId, population] of Object.entries(expected)) {
    assert.deepEqual(weekPopulation(contentId), population, contentId)
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

  await collect(store, neople, COLLECTED_AT)

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
      '20261003T0600/20261112T0559'
    ]
  )
  assert.deepEqual(storedClears(state), [
    `nabel-hard/b/${at('2025-06-05T06:00').toISOString()}/null`
  ])
  const entryFames = new Map(CLEAR_CONTENTS.map(({ id, entryFame }) => [id, entryFame]))
  for (const { contentId, weekStart } of reopened) {
    const stored = state.populations.get(populationKey({ contentId, weekStart }))
    assert.deepEqual(
      [stored?.population, stored?.minFame, stored?.closed],
      [2, entryFames.get(contentId), true],
      `${contentId}/${formatResetDate(weekStart)}`
    )
  }
})

test('30일보다 오래된 주를 다시 받을 때는 비활성 캐릭터에게도 요청해 지난 클리어를 센다', async () => {
  const reopened = closedPastWeeks().map((stored) => ({ ...stored, closed: false }))
  const { state, store } = memoryClearStore(
    [character('a', 130_000), character('b', 110_000)],
    reopened,
    new Set(['b'])
  )
  const { neople, requests } = fakeNeople({ b: [nabelHard('2025-06-05 21:00')] })

  await collect(store, neople, COLLECTED_AT)

  assert.deepEqual(new Set(requests.map(({ characterId }) => characterId)), new Set(['a', 'b']))
  assert.deepEqual(storedClears(state), [
    `nabel-hard/b/${at('2025-06-05T06:00').toISOString()}/null`
  ])
})

test('목요일 06:00 뒤에 성공한 수집은 다음 목요일 06:00이 지나야 보충 대상이 된다', async () => {
  const { store } = memoryClearStore([])
  const job = createContentClearCollectionJob(
    new ContentClearCollectionService(store, {
      createFetchTimeline: createNeopleClearTimeline(fakeNeople({}).neople),
      readConcurrency: () => 1,
      now: () => COLLECTED_AT,
      pause: async () => {},
      report: () => {}
    })
  )
  const unused = async () => {
    throw new Error('not used')
  }
  const jobStore: JobRepository = {
    registerJobs: unused,
    interruptRunningRuns: unused,
    isPaused: async () => false,
    readLastScheduledSuccess: async () => at('2026-11-12T06:00'),
    startRun: unused,
    claimRequestedRun: unused,
    recordProgress: unused,
    finishRun: unused,
    recordNextRun: unused,
    recordWorkerSeen: unused
  }
  const dueAt = async (now: Date) =>
    (
      await new JobSchedulerService(jobStore, { jobs: [job], report: () => {} }).findCatchupJobs(
        now,
        createJobSchedule
      )
    ).map(({ name }) => name)

  assert.deepEqual(await dueAt(at('2026-11-18T23:00')), [])
  assert.deepEqual(await dueAt(at('2026-11-19T05:30')), [])
  assert.deepEqual(await dueAt(at('2026-11-19T06:30')), ['content-clear-collection'])
})

test('주 중간 수집은 진행 중인 주를 받지 않고, 목요일 06:00 뒤 수집이 지난주 끝까지 받아 마감하며, 마감한 주는 다음 수집이 바꾸지 않는다', async () => {
  const lastWeek = LAST_WEEK
  const thisWeek = at('2026-11-12T06:00')
  const memory = memoryClearStore([character('a'), character('b')], closedPastWeeks())
  const timelines: Record<string, NeopleTimelineRow[]> = {
    a: [michaelaHard('2026-11-07 21:15')],
    b: [michaelaHard('2026-11-11 23:00'), michaelaNormal('2026-11-12 06:30')]
  }
  const { neople, requests } = fakeNeople(timelines)

  await collect(memory.store, neople, at('2026-11-11T20:00'))
  assert.deepEqual(populationsOf(memory.state, lastWeek), [])
  await collect(memory.store, neople, COLLECTED_AT)
  const closedClears = storedClears(memory.state)
  memory.state.population = [character('a'), character('b'), character('c')]
  timelines.c = [michaelaHard('2026-11-10 21:00'), michaelaHard('2026-11-12 21:00')]
  await collect(memory.store, neople, at('2026-11-19T07:00'))

  assert.deepEqual(
    requests.map(({ characterId, startDate, endDate }) => `${characterId}/${startDate}/${endDate}`),
    [
      'a/20261105T0600/20261112T0559',
      'b/20261105T0600/20261112T0559',
      'a/20261112T0600/20261119T0559',
      'b/20261112T0600/20261119T0559',
      'c/20261112T0600/20261119T0559'
    ]
  )
  assert.deepEqual(populationsOf(memory.state, lastWeek), everyContent(2, true))
  assert.deepEqual(populationsOf(memory.state, thisWeek), everyContent(3, true))
  const lastWeekClears = (clears: string[]) =>
    clears.filter((clear) => clear.includes(lastWeek.toISOString()))
  assert.deepEqual(lastWeekClears(storedClears(memory.state)), lastWeekClears(closedClears))
  assert.deepEqual(lastWeekClears(closedClears), [
    `michaela-hard/a/${lastWeek.toISOString()}/null`,
    `michaela-hard/b/${lastWeek.toISOString()}/null`
  ])
})

test('출시 첫 주와 마감하지 않은 지난주만 저장한 레이드는 그 사이 모든 주를 받아 마감하고, 마감한 출시 첫 주는 바꾸지 않으며, 다 마감한 뒤 수집은 요청하지 않고, 마감한 분모를 빈 주 없이 남긴다', async () => {
  const seeded = [
    ...raidFirstWeeks(),
    ...raidFirstWeeks().map(({ contentId }) => storedPopulation(contentId, LAST_WEEK, false))
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

  await collect(store, neople, COLLECTED_AT)
  const firstRequests = requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`)
  requests.length = 0
  await collect(store, neople, at('2026-11-13T12:00'))

  assert.deepEqual(firstRequests, [...BACKFILL_RANGES, '20261010T0600/20261112T0559'])
  assert.deepEqual(requests, [])
  assert.deepEqual(storedClears(state), [
    `diregie-hard/a/${at('2026-02-12T06:00').toISOString()}/null`,
    `michaela-hard/a/${at('2026-08-20T06:00').toISOString()}/null`,
    `michaela-hard/a/${LAST_WEEK.toISOString()}/null`,
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
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(1, true))

  for (const content of CLEAR_CONTENTS) {
    const releaseWeek = startOfResetWeek(content.releasedAt)
    const expected = [...weeksBefore(releaseWeek, LAST_WEEK), LAST_WEEK].map((week) =>
      formatResetDate(week)
    )
    const closedWeeks = [...state.populations.values()]
      .filter(({ contentId, closed }) => contentId === content.id && closed)
      .map(({ weekStart }) => weekStart)
      .toSorted((left, right) => left.getTime() - right.getTime())
      .map((week) => formatResetDate(week))
    assert.deepEqual(closedWeeks, expected, content.id)
  }
})

test('새 컨텐츠에 밀려난 레이드도 주가 끝날 때마다 그 주 클리어를 저장하고 마감한다', async () => {
  const nextWeek = at('2026-11-12T06:00')
  const { state, store } = memoryClearStore([character('a')], closedPastWeeks())
  const { neople, requests } = fakeNeople({
    a: [diregieHard('2026-11-08 21:00'), nabelHard('2026-11-12 21:00')]
  })

  await collect(store, neople, COLLECTED_AT)
  await collect(store, neople, at('2026-11-19T07:00'))

  assert.deepEqual(
    requests.map(({ startDate, endDate }) => `${startDate}/${endDate}`),
    ['20261105T0600/20261112T0559', '20261112T0600/20261119T0559']
  )
  assert.deepEqual(storedClears(state), [
    `diregie-hard/a/${LAST_WEEK.toISOString()}/null`,
    `nabel-hard/a/${nextWeek.toISOString()}/null`
  ])
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(1, true))
  assert.deepEqual(populationsOf(state, nextWeek), everyContent(1, true))
})

test('Neople 한도 초과면 쉬었다가 같은 캐릭터를 다시 받고, Neople에 없는 캐릭터는 건너뛴다', async () => {
  const { state, store } = memoryClearStore(
    [character('a'), character('b'), character('missing')],
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

  const summary = await collect(store, neople, COLLECTED_AT, pauses)

  assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS])
  assert.deepEqual(
    requests.map(({ characterId }) => characterId),
    ['a', 'a', 'b', 'missing']
  )
  assert.deepEqual(
    storedClears(state).map((clear) => clear.split('/').slice(0, 2).join('/')),
    ['michaela-hard/a', 'michaela-hard/b']
  )
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(3, true))
  assert.deepEqual(summary, {
    startedAt: COLLECTED_AT.toISOString(),
    characters: 3,
    requests: 4,
    clears: 2,
    records: 2,
    skipped: 1
  })
})

function collectGroup(
  store: ClearCollectionRepository,
  neople: Pick<NeopleClient, 'characterTimeline'>,
  concurrency: number
) {
  const pauses: number[] = []
  const reports: [string, Readonly<Record<string, string | number>>][] = []
  const summary = new ContentClearCollectionService(store, {
    createFetchTimeline: createNeopleClearTimeline(neople),
    readConcurrency: () => concurrency,
    now: () => COLLECTED_AT,
    pause: async (ms) => {
      pauses.push(ms)
    },
    report: (code, details) => {
      reports.push([code, details])
    }
  }).collect(() => {})

  return { summary, pauses, reports }
}

test('묶음의 다른 캐릭터는 받았는데 한 캐릭터만 unavailable이면 쉬지 않고 그 캐릭터만 다시 받고, 세 번 연속이면 건너뛰고 나머지를 저장한다', async () => {
  const { state, store } = memoryClearStore(
    [character('a'), character('a-stuck'), character('b'), character('c')],
    closedPastWeeks()
  )
  const { neople, requests } = fakeNeople(
    {
      a: [michaelaHard('2026-11-07 21:15')],
      b: [michaelaHard('2026-11-08 21:15')],
      c: [michaelaHard('2026-11-09 21:15')]
    },
    ({ characterId }) =>
      characterId === 'a-stuck' ? new NeopleRequestFailure('unavailable') : undefined
  )

  const { summary, pauses, reports } = collectGroup(store, neople, 3)

  assert.deepEqual(await summary, {
    startedAt: COLLECTED_AT.toISOString(),
    characters: 4,
    requests: 6,
    clears: 3,
    records: 3,
    skipped: 1
  })
  assert.deepEqual(pauses, [])
  assert.equal(requests.filter(({ characterId }) => characterId === 'a-stuck').length, 3)
  assert.equal(requests.filter(({ characterId }) => characterId === 'a').length, 1)
  assert.deepEqual(
    storedClears(state).map((clear) => clear.split('/').slice(0, 2).join('/')),
    ['michaela-hard/a', 'michaela-hard/b', 'michaela-hard/c']
  )
  assert.deepEqual(
    reports.filter(([code]) => code === 'CONTENT_CLEAR_NEOPLE_UNAVAILABLE'),
    [3, 1, 1].map((characters) => [
      'CONTENT_CLEAR_NEOPLE_UNAVAILABLE',
      { done: 0, characters, unavailable: 1, paused: 0, reasons: 'unavailable=1' }
    ])
  )
  assert.deepEqual(
    reports.filter(([code]) => code === 'CONTENT_CLEAR_CHARACTER_SKIPPED'),
    [['CONTENT_CLEAR_CHARACTER_SKIPPED', { position: 1 }]]
  )
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(4, true))
  assert.equal(state.progress, undefined)
})

test('묶음 전체가 unavailable이면 몇 번이 이어져도 건너뛰지 않고 진행 위치를 그대로 둔 채 같은 묶음을 다시 받는다', async () => {
  const outageAttempts = 5
  const memory = memoryClearStore([character('a'), character('b')], closedPastWeeks())
  const progressDuringOutage: (number | undefined)[] = []
  const { neople } = fakeNeople(
    { a: [michaelaHard('2026-11-07 21:15')], b: [michaelaHard('2026-11-08 21:15')] },
    ({ characterId }, previous) => {
      const attempts = previous.filter((request) => request.characterId === characterId).length
      if (attempts >= outageAttempts) {
        return undefined
      }
      progressDuringOutage.push(memory.state.progress?.done)

      return new NeopleRequestFailure('unavailable')
    }
  )

  const { summary, pauses } = collectGroup(memory.store, neople, 2)

  assert.deepEqual(await summary, {
    startedAt: COLLECTED_AT.toISOString(),
    characters: 2,
    requests: 12,
    clears: 2,
    records: 2,
    skipped: 0
  })
  assert.deepEqual(pauses, Array(outageAttempts).fill(UNAVAILABLE_PAUSE_MS))
  assert.deepEqual(progressDuringOutage, Array(outageAttempts * 2).fill(0))
  assert.deepEqual(
    storedClears(memory.state).map((clear) => clear.split('/').slice(0, 2).join('/')),
    ['michaela-hard/a', 'michaela-hard/b']
  )
})

test('두 번 연속 unavailable이던 캐릭터가 세 번째에 받아지면 건너뛰지 않고 저장한다', async () => {
  const { state, store } = memoryClearStore([character('a'), character('b')], closedPastWeeks())
  const { neople } = fakeNeople(
    { a: [michaelaHard('2026-11-07 21:15')], b: [michaelaHard('2026-11-08 21:15')] },
    ({ characterId }, previous) =>
      characterId === 'b' && previous.filter((request) => request.characterId === 'b').length < 2
        ? new NeopleRequestFailure('unavailable')
        : undefined
  )

  const { summary, pauses } = collectGroup(store, neople, 2)

  assert.equal((await summary).skipped, 0)
  assert.deepEqual(pauses, [])
  assert.deepEqual(
    storedClears(state).map((clear) => clear.split('/').slice(0, 2).join('/')),
    ['michaela-hard/a', 'michaela-hard/b']
  )
})

test('다시 받을 때 묶음 크기, 받지 못한 캐릭터 수, 쉬었는지, Neople이 거절한 status와 code별 수를 남긴다', async () => {
  const { store } = memoryClearStore(
    ['a', 'b', 'c', 'd', 'e'].map((id) => character(id)),
    closedPastWeeks()
  )
  const failures: Record<string, NeopleRequestFailure> = {
    a: new NeopleRequestFailure('timeout'),
    b: new NeopleRequestFailure('unavailable', { upstream: { status: 429, code: 'API002' } }),
    c: new NeopleRequestFailure('unavailable', { upstream: { status: 429, code: 'API002' } }),
    d: new NeopleRequestFailure('unavailable', { upstream: { status: 503, code: undefined } })
  }
  const { neople } = fakeNeople({}, ({ characterId }, previous) => {
    if (previous.some((request) => request.characterId === characterId)) {
      return undefined
    }

    return failures[characterId]
  })

  const { summary, reports } = collectGroup(store, neople, 5)
  await summary

  assert.deepEqual(
    reports.filter(([code]) => code === 'CONTENT_CLEAR_NEOPLE_UNAVAILABLE'),
    [
      [
        'CONTENT_CLEAR_NEOPLE_UNAVAILABLE',
        {
          done: 0,
          characters: 5,
          unavailable: 4,
          paused: 0,
          reasons: '429/API002=2,503/none=1,timeout=1'
        }
      ]
    ]
  )
})

test('새 캐릭터 대기열이 차 있는 동안에도 클리어 수집 요청이 함께 나가고, 두 작업의 요청을 합쳐도 초당 상한을 넘지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 })
  const requestsPerSecond = 5
  const calls: { kind: 'basic' | 'timeline'; at: number }[] = []
  const client: WorkerNeople = {
    character: async () => {
      throw new Error('이 테스트는 상세 섹션을 부르지 않는다')
    },
    multiItems: async () => {
      throw new Error('이 테스트는 아이템 상세를 부르지 않는다')
    },
    auction: async () => {
      throw new Error('이 테스트는 경매장을 부르지 않는다')
    },
    searchItems: async () => {
      throw new Error('이 테스트는 아이템 검색을 부르지 않는다')
    },
    servers: async () => {
      throw new Error('이 테스트는 서버 목록을 부르지 않는다')
    },
    jobs: async () => {
      throw new Error('이 테스트는 직업 목록을 부르지 않는다')
    },
    charactersFame: async () => {
      throw new Error('이 테스트는 명성 검색을 부르지 않는다')
    },
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
  }
  const { neople } = pacePrioritizedNeopleRequests(
    { neople: client, priorityNeople: client },
    requestsPerSecond
  )
  let queueOpen = true
  let queued = 0
  const collectionStore: Omit<CollectionRepository, 'enqueue'> = {
    takeBatch: async (): Promise<CollectedCharacter[]> =>
      queueOpen ? [{ serverId: 'cain', characterId: `queued-${queued++}` }] : [],
    recordBasic: async () => {},
    recordFailure: async () => {}
  }
  const settled = { collection: false, clears: false }
  const collection = new CharacterCollectionService(
    { ...collectionStore, enqueue: async () => {} },
    {
      readModifiedTime: readImportModifiedTime,
      importCharacters: importCollectedCharacters,
      importFiles: [],
      fetchBasic: createNeopleCharacterBasic(neople),
      readConcurrency: () => 1,
      report: () => {},
      pause: async () => {}
    }
  )
    .runPass(new Map())
    .finally(() => {
      settled.collection = true
    })
  const { store } = memoryClearStore(
    ['a', 'b', 'c', 'd'].map((id) => character(id)),
    closedPastWeeks()
  )
  const clears = collect(store, neople, COLLECTED_AT).finally(() => {
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

// key마다 받은 요청과 동시 요청 수를 세는 가짜 client다. 타임라인은 빈 기록을 준다. key는 합성 값이다.
function fakeBatchKeys(
  initialIds: number[],
  concurrencyPerKey: number,
  fail: (key: string, characterId: string) => Error | undefined = () => undefined
) {
  const keys = initialIds.map((id) => ({ id, key: `synthetic-key-${id}` }))
  const requests: { key: string; characterId: string }[] = []
  const active = new Map<string, number>()
  const maxActive = new Map<string, number>()
  const createKeyNeople = (key: string): WorkerNeople => ({
    character: async () => {
      throw new Error('이 테스트는 상세 섹션을 부르지 않는다')
    },
    multiItems: async () => {
      throw new Error('이 테스트는 아이템 상세를 부르지 않는다')
    },
    auction: async () => {
      throw new Error('이 테스트는 경매장을 부르지 않는다')
    },
    searchItems: async () => {
      throw new Error('이 테스트는 아이템 검색을 부르지 않는다')
    },
    servers: async () => {
      throw new Error('이 테스트는 서버 목록을 부르지 않는다')
    },
    jobs: async () => {
      throw new Error('이 테스트는 직업 목록을 부르지 않는다')
    },
    charactersFame: async () => {
      throw new Error('이 테스트는 명성 검색을 부르지 않는다')
    },
    characterBasic: async () => {
      throw new Error('이 테스트는 기본 정보를 부르지 않는다')
    },
    characterSkillStyle: async () => {
      throw new Error('이 테스트는 스킬 스타일을 부르지 않는다')
    },
    characterTimeline: async ({ characterId }) => {
      requests.push({ key, characterId })
      const running = (active.get(key) ?? 0) + 1
      active.set(key, running)
      const previousMax = maxActive.get(key) ?? 0
      maxActive.set(key, Math.max(previousMax, running))

      try {
        await setImmediate()
        const failure = fail(key, characterId)
        if (failure !== undefined) {
          throw failure
        }

        return { timeline: { rows: [], next: null } }
      } finally {
        active.set(key, (active.get(key) ?? 1) - 1)
      }
    }
  })
  const createNeople = (key: string) => {
    const neople = createKeyNeople(key)

    return { neople, priorityNeople: neople }
  }
  const pool = createBatchNeopleKeyPool({
    store: {
      readUsableKeys: async () => [...keys],
      recordRejected: async () => {}
    },
    createNeople,
    concurrencyPerKey,
    report: () => {}
  })

  return { keys, pool, requests, maxActive }
}

function collectWithKeys(
  store: ClearCollectionRepository,
  pool: BatchNeopleKeyPool,
  pause: (ms: number) => Promise<void> = async () => {}
) {
  const progress: number[] = []
  const reports: [string, Readonly<Record<string, string | number>>][] = []
  const createFetchTimeline = createNeopleClearTimeline(pool.neople)
  const summary = new ContentClearCollectionService(store, {
    createFetchTimeline,
    readConcurrency: pool.readConcurrency,
    now: () => COLLECTED_AT,
    pause,
    report: (code, details) => {
      reports.push([code, details])
    }
  }).collect((done) => {
    progress.push(done)
  })

  return { summary, progress, reports }
}

const syntheticPopulation = (count: number) =>
  Array.from({ length: count }, (_, index) => character(`c${index}`))

const API002 = () =>
  new NeopleRequestFailure('unavailable', { upstream: { status: 400, code: 'API002' } })

test('key 3개에 key당 동시 수가 32이면 클리어 수집 묶음이 96명이고, 어느 key도 동시에 32건을 넘게 보내지 않는다', async () => {
  const { store } = memoryClearStore(syntheticPopulation(200), closedPastWeeks())
  const { pool, maxActive } = fakeBatchKeys([1, 2, 3], 32)
  await pool.refresh()

  const { summary, progress } = collectWithKeys(store, pool)

  assert.equal((await summary).skipped, 0)
  assert.deepEqual(progress, [96, 192, 200])
  assert.deepEqual(
    [...maxActive].sort(([left], [right]) => left.localeCompare(right)),
    [
      ['synthetic-key-1', 32],
      ['synthetic-key-2', 32],
      ['synthetic-key-3', 32]
    ]
  )
})

test('한 key가 API002를 받으면 그 요청은 다른 key로 받아 묶음이 쉬지 않고, 그 key는 60초 동안 새 요청을 받지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: COLLECTED_AT.getTime() })
  const { store } = memoryClearStore(syntheticPopulation(8), closedPastWeeks())
  let limited: { characterId: string; requestsBefore: number } | undefined
  const { keys, pool, requests } = fakeBatchKeys([1, 2], 2, (key, characterId) => {
    if (limited === undefined && key === 'synthetic-key-1') {
      limited = { characterId, requestsBefore: requests.length }

      return API002()
    }

    return undefined
  })
  await pool.refresh()
  const pauses: number[] = []

  const { summary } = collectWithKeys(store, pool, async (ms) => {
    pauses.push(ms)
  })

  assert.equal((await summary).skipped, 0)
  assert.deepEqual(pauses, [])
  assert(limited !== undefined)
  const afterLimit = requests.slice(limited.requestsBefore)
  assert.ok(afterLimit.every(({ key }) => key === 'synthetic-key-2'))
  assert.ok(afterLimit.some(({ characterId }) => characterId === limited?.characterId))

  keys.splice(1, 1)
  await pool.refresh()
  t.mock.timers.tick(61_000)
  await pool.neople.characterTimeline(character('later'), { next: 'synthetic' })
  assert.equal(requests.at(-1)?.key, 'synthetic-key-1')
})

test('모든 key가 API002를 받으면 1분 쉬고 같은 묶음을 다시 보낸다', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: COLLECTED_AT.getTime() })
  const { store } = memoryClearStore(syntheticPopulation(1), closedPastWeeks())
  const limitedKeys = new Set<string>()
  const { pool, requests } = fakeBatchKeys([1, 2], 1, (key) => {
    if (limitedKeys.has(key)) {
      return undefined
    }

    limitedKeys.add(key)

    return API002()
  })
  await pool.refresh()
  const pauses: number[] = []

  const { summary, reports } = collectWithKeys(store, pool, async (ms) => {
    pauses.push(ms)
    t.mock.timers.tick(ms)
  })

  assert.equal((await summary).skipped, 0)
  assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS])
  assert.deepEqual(
    reports.filter(([code]) => code === 'CONTENT_CLEAR_NEOPLE_UNAVAILABLE'),
    [
      [
        'CONTENT_CLEAR_NEOPLE_UNAVAILABLE',
        { done: 0, characters: 1, unavailable: 1, paused: 1, reasons: 'all-resting=1' }
      ]
    ]
  )
  assert.deepEqual(
    requests.map(({ key }) => key),
    ['synthetic-key-1', 'synthetic-key-2', 'synthetic-key-1']
  )
})

test('실행 중에 key를 더하거나 끄면 다음 묶음부터 묶음 크기와 요청을 받는 key가 바뀐다', async () => {
  const memory = memoryClearStore(syntheticPopulation(10), closedPastWeeks())
  const { keys, pool, requests } = fakeBatchKeys([1], 2)
  await pool.refresh()
  const store: ClearCollectionRepository = {
    ...memory.store,
    recordProgress: async (progress) => {
      await memory.store.recordProgress(progress)

      if (progress.done === 2) {
        keys.push({ id: 2, key: 'synthetic-key-2' })
        await pool.refresh()
      }

      if (progress.done === 6) {
        keys.splice(0, 1)
        await pool.refresh()
      }
    }
  }

  const { summary, progress } = collectWithKeys(store, pool)

  assert.equal((await summary).skipped, 0)
  assert.deepEqual(progress, [2, 6, 8, 10])

  const keysOf = (characterIds: string[]) =>
    [
      ...new Set(
        requests
          .filter(({ characterId }) => characterIds.includes(characterId))
          .map(({ key }) => key)
      )
    ].sort()

  assert.deepEqual(keysOf(['c0', 'c1']), ['synthetic-key-1'])
  assert.deepEqual(keysOf(['c2', 'c3', 'c4', 'c5']), ['synthetic-key-1', 'synthetic-key-2'])
  assert.deepEqual(keysOf(['c6', 'c7', 'c8', 'c9']), ['synthetic-key-2'])
})

test('켜진 key가 없으면 Neople을 부르지 않고 no-key로 남긴 뒤 1분 쉬고, key가 켜지면 이어서 받는다', async () => {
  const { store } = memoryClearStore(syntheticPopulation(3), closedPastWeeks())
  const { keys, pool, requests } = fakeBatchKeys([], 2)
  await pool.refresh()
  const requestsBeforeKey: number[] = []
  const pauses: number[] = []

  const { summary, progress, reports } = collectWithKeys(store, pool, async (ms) => {
    pauses.push(ms)
    requestsBeforeKey.push(requests.length)

    if (requestsBeforeKey.length === 2) {
      keys.push({ id: 1, key: 'synthetic-key-1' })
      await pool.refresh()
    }
  })

  assert.equal((await summary).skipped, 0)
  assert.deepEqual(requestsBeforeKey, [0, 0])
  assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS, UNAVAILABLE_PAUSE_MS])
  assert.deepEqual(
    reports.filter(([code]) => code === 'CONTENT_CLEAR_NEOPLE_UNAVAILABLE'),
    Array(2).fill([
      'CONTENT_CLEAR_NEOPLE_UNAVAILABLE',
      { done: 0, characters: 1, unavailable: 1, paused: 1, reasons: 'no-key=1' }
    ])
  )
  assert.deepEqual(progress, [1, 3])
  assert.equal(requests.length, 3)
})

const storedRecords = (state: ReturnType<typeof memoryClearStore>['state']) =>
  [...state.records.values()]
    .map((record) => {
      const stage =
        record.kind === 'raid'
          ? `${record.modeName ?? '-'}/${record.hard}/${record.partyName ?? '-'}`
          : '-/-/-'

      return `${record.kind}/${record.characterId}/${record.name}/${stage}/${record.clearedAt.toISOString()}/${record.weekStart.toISOString()}`
    })
    .sort()

test('수집은 레이드의 모든 단계와 공격대 이름, 모든 레기온 기록을 기록 테이블에 남기고 클리어 집계에는 일반, 하드 판정에 맞는 기록만 넣는다', async () => {
  const { state, store } = memoryClearStore([character('a'), character('b')], closedPastWeeks())
  const { neople } = fakeNeople({
    a: [
      michaelaMatching('2026-11-06 20:00'),
      raidRow('2026-11-06 21:00', { raidName: '디레지에 레이드', modeName: '디레지에 : 서막' }),
      raidRow('2026-11-06 22:00', { raidName: '기계 혁명', modeName: '개전' }),
      michaelaNormal('2026-11-07 20:00', { raidPartyName: null }),
      michaelaHard('2026-11-07 21:15'),
      { ...michaelaHard('2026-11-08 21:00'), code: 210 },
      legionRow('2026-11-08 22:00')
    ],
    b: [
      raidRow('2026-11-09 20:00', { raidName: '이내 황혼전' }),
      { code: 209, name: '레기온', date: '2026-11-09 21:00', data: { regionName: '합성 레기온' } }
    ]
  })

  const summary = await collect(store, neople, COLLECTED_AT)

  const week = LAST_WEEK.toISOString()
  const recordAt = (time: string) => `${at(time).toISOString()}/${week}`
  assert.deepEqual(storedRecords(state), [
    `legion/a/베누스/-/-/-/${recordAt('2026-11-08T22:00')}`,
    `legion/b/합성 레기온/-/-/-/${recordAt('2026-11-09T21:00')}`,
    `raid/a/기계 혁명/개전/false/합성 공격대/${recordAt('2026-11-06T22:00')}`,
    `raid/a/디레지에 레이드/디레지에 : 서막/false/합성 공격대/${recordAt('2026-11-06T21:00')}`,
    `raid/a/무너진 성자 미카엘라/미카엘라 : 균열서/false/합성 공격대/${recordAt('2026-11-06T20:00')}`,
    `raid/a/무너진 성자 미카엘라/미카엘라 : 종언서(하드)/true/합성 공격대/${recordAt('2026-11-07T21:15')}`,
    `raid/a/무너진 성자 미카엘라/미카엘라 : 종언서(하드)/true/합성 공격대/${recordAt('2026-11-08T21:00')}`,
    `raid/a/무너진 성자 미카엘라/미카엘라 : 종언서/false/-/${recordAt('2026-11-07T20:00')}`,
    `raid/b/이내 황혼전/-/false/합성 공격대/${recordAt('2026-11-09T20:00')}`
  ])
  assert.deepEqual(storedClears(state), [
    `inae-twilight/b/${week}/null`,
    `michaela-hard/a/${week}/null`,
    `michaela-normal/a/${week}/null`
  ])
  assert.deepEqual(populationsOf(state, LAST_WEEK), everyContent(2, true))
  assert.equal(summary.records, 9)
  assert.equal(summary.clears, 4)
})

// 지난 기록 받기의 진행 위치만 따로 두고, 분모와 기록은 클리어 수집 fake의 상태를 함께 쓴다.
function memoryBackfillStore(
  memory: ReturnType<typeof memoryClearStore>,
  initialCursors: readonly ClearRecordCursor[] = []
) {
  const progress = { current: undefined as ClearRecordBackfillProgress | undefined }
  const cursorKey = ({ serverId, characterId }: Omit<ClearRecordCursor, 'fetchedUntil'>) =>
    `${serverId}/${characterId}`
  const cursors = new Map(initialCursors.map((cursor) => [cursorKey(cursor), cursor]))
  const store: ClearRecordBackfillRepository = {
    countPopulation: memory.store.countPopulation,
    readPopulationPage: memory.store.readPopulationPage,
    readProgress: async () => {
      if (progress.current === undefined) {
        return undefined
      }

      return { ...progress.current }
    },
    startProgress: async (startedAt) => {
      progress.current = { startedAt, done: 0 }
    },
    recordProgress: async (next) => {
      progress.current = { ...next }
    },
    recordRecords: memory.store.recordRecords,
    readCursors: async () => [...cursors.values()],
    recordCursors: async (characters, fetchedUntil) => {
      for (const { serverId, characterId } of characters) {
        cursors.set(cursorKey({ serverId, characterId }), { serverId, characterId, fetchedUntil })
      }
    },
    finishProgress: async () => {
      progress.current = undefined
    }
  }

  return { progress, cursors, store }
}

function backfill(
  store: ClearRecordBackfillRepository,
  neople: Pick<NeopleClient, 'characterTimeline'>,
  now: Date,
  reports: [string, Readonly<Record<string, string | number>>][] = [],
  pauses: number[] = []
) {
  return new ClearRecordBackfillService(store, {
    createFetchTimeline: createNeopleClearRecordTimeline(neople),
    readConcurrency: () => 1,
    now: () => now,
    pause: async (ms) => {
      pauses.push(ms)
    },
    report: (code, details) => {
      reports.push([code, details])
    }
  }).backfill(() => {})
}

// 2025-02-06 06:00부터 89일씩 나눈 구간이다.
const RECORD_BACKFILL_RANGES = [
  '20250206T0600/20250506T0559',
  '20250506T0600/20250803T0559',
  '20250803T0600/20251031T0559',
  '20251031T0600/20260128T0559',
  '20260128T0600/20260427T0559',
  '20260427T0600/20260725T0559',
  '20260725T0600/20261022T0559'
]

test('지난 기록 받기는 비활성 캐릭터까지 2025-02-06부터 시작 시각까지 code 201, 209, 210만 받아 레이드, 레기온 기록을 저장한다', async () => {
  const memory = memoryClearStore([character('a', 130_000), character('b')], [], new Set(['b']))
  const { progress, store } = memoryBackfillStore(memory)
  const { neople, requests } = fakeNeople({
    a: [
      raidRow('2025-02-05 23:00', { raidName: '합성 이전 레이드' }),
      legionRow('2025-02-06 06:30'),
      nabelHard('2025-06-05 21:00'),
      michaelaMatching('2026-10-01 20:00')
    ],
    b: [michaelaHard('2026-11-07 21:15'), nightmareTitle('2026-11-06 23:59')]
  })

  const summary = await backfill(store, neople, NOW)

  const ranges = [...RECORD_BACKFILL_RANGES, '20261022T0600/20261110T1200']

  for (const characterId of ['a', 'b']) {
    assert.deepEqual(
      requests
        .filter((request) => request.characterId === characterId)
        .map(({ code, startDate, endDate }) => `${code}:${startDate}/${endDate}`),
      ranges.map((range) => `201,209,210:${range}`)
    )
  }

  assert.deepEqual(
    storedRecords(memory.state).map((record) => record.split('/').slice(0, 3).join('/')),
    [
      'legion/a/베누스',
      'raid/a/만들어진 신 나벨',
      'raid/a/무너진 성자 미카엘라',
      'raid/b/무너진 성자 미카엘라'
    ]
  )
  assert.deepEqual(summary, {
    startedAt: NOW.toISOString(),
    characters: 2,
    requests: 16,
    records: 4,
    skipped: 0
  })
  assert.equal(progress.current, undefined)
})

test('지난 기록 받기가 도중에 끝나면 다음 실행이 처음 시작 시각의 구간으로 처리한 캐릭터 다음부터 이어 받는다', async () => {
  const memory = memoryClearStore(['a', 'b', 'c', 'd'].map((id) => character(id)))
  const backfillMemory = memoryBackfillStore(memory)
  let stopped = false
  const store: ClearRecordBackfillRepository = {
    ...backfillMemory.store,
    recordRecords: async (records) => {
      if (!stopped && records.some(({ characterId }) => characterId === 'c')) {
        stopped = true
        throw new Error('worker stopped')
      }

      await backfillMemory.store.recordRecords(records)
    }
  }
  const { neople, requests } = fakeNeople({
    a: [nabelHard('2025-06-05 21:00')],
    c: [legionRow('2025-03-01 20:00')],
    d: [michaelaHard('2026-11-07 21:15')]
  })

  await assert.rejects(backfill(store, neople, NOW), { message: 'worker stopped' })
  assert.equal(backfillMemory.progress.current?.done, 2)
  const resumed = await backfill(store, neople, at('2026-11-12T07:00'))

  const ranges = [...RECORD_BACKFILL_RANGES, '20261022T0600/20261110T1200']
  const rangesOf = (characterId: string) =>
    requests
      .filter((request) => request.characterId === characterId)
      .map(({ startDate, endDate }) => `${startDate}/${endDate}`)
  assert.deepEqual(rangesOf('a'), ranges)
  assert.deepEqual(rangesOf('b'), ranges)
  assert.deepEqual(rangesOf('c'), [...ranges, ...ranges])
  assert.deepEqual(rangesOf('d'), ranges)
  assert.deepEqual(
    storedRecords(memory.state).map((record) => record.split('/').slice(0, 3).join('/')),
    ['legion/c/베누스', 'raid/a/만들어진 신 나벨', 'raid/d/무너진 성자 미카엘라']
  )
  assert.equal(resumed.startedAt, NOW.toISOString())
  assert.equal(backfillMemory.progress.current, undefined)
})

test('지난 기록 받기도 Neople 한도 초과면 쉬었다가 같은 캐릭터를 다시 받고, Neople에 없는 캐릭터는 건너뛴다', async () => {
  const memory = memoryClearStore([character('a'), character('missing'), character('b')])
  const { store } = memoryBackfillStore(memory)
  const { neople } = fakeNeople(
    { a: [legionRow('2026-11-08 21:00')], b: [michaelaHard('2026-11-08 21:15')] },
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

  const reports: [string, Readonly<Record<string, string | number>>][] = []
  const pauses: number[] = []

  const summary = await backfill(store, neople, NOW, reports, pauses)

  assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS])
  assert.deepEqual(
    reports.filter(([code]) => code === 'CLEAR_RECORD_BACKFILL_NEOPLE_UNAVAILABLE'),
    [
      [
        'CLEAR_RECORD_BACKFILL_NEOPLE_UNAVAILABLE',
        { done: 0, characters: 1, unavailable: 1, paused: 1, reasons: 'unavailable=1' }
      ]
    ]
  )
  assert.deepEqual(
    storedRecords(memory.state).map((record) => record.split('/').slice(0, 2).join('/')),
    ['legion/a', 'raid/b']
  )
  assert.equal(summary.records, 2)
  assert.equal(summary.skipped, 1)
})

test('지난 기록 받기는 전에 받은 캐릭터를 받은 시각 30분 전부터만 받고, 받지 못한 캐릭터의 받은 시각은 옮기지 않는다', async () => {
  const memory = memoryClearStore([character('a'), character('b'), character('missing')])
  const { cursors, store } = memoryBackfillStore(memory, [
    { serverId: 'cain', characterId: 'a', fetchedUntil: at('2026-11-03T12:00') },
    { serverId: 'cain', characterId: 'missing', fetchedUntil: at('2026-11-03T12:00') }
  ])
  const { neople, requests } = fakeNeople(
    {
      a: [nabelHard('2026-11-03 11:40'), michaelaHard('2026-11-07 21:15')],
      b: [legionRow('2025-03-01 20:00')]
    },
    (request) =>
      request.characterId === 'missing'
        ? new NeopleRequestFailure('api', { characterNotFound: true })
        : undefined
  )

  const summary = await backfill(store, neople, NOW)

  const rangesOf = (characterId: string) =>
    requests
      .filter((request) => request.characterId === characterId)
      .map(({ startDate, endDate }) => `${startDate}/${endDate}`)
  assert.deepEqual(rangesOf('a'), ['20261103T1130/20261110T1200'])
  assert.deepEqual(rangesOf('b'), [...RECORD_BACKFILL_RANGES, '20261022T0600/20261110T1200'])
  assert.deepEqual(
    storedRecords(memory.state).map((record) => record.split('/').slice(0, 3).join('/')),
    ['legion/b/베누스', 'raid/a/만들어진 신 나벨', 'raid/a/무너진 성자 미카엘라']
  )
  assert.deepEqual(
    [...cursors.values()]
      .map(({ characterId, fetchedUntil }) => [characterId, fetchedUntil])
      .toSorted(([left], [right]) => String(left).localeCompare(String(right))),
    [
      ['a', NOW],
      ['b', NOW],
      ['missing', at('2026-11-03T12:00')]
    ]
  )
  assert.equal(summary.requests, 10)
  assert.equal(summary.skipped, 1)
})
