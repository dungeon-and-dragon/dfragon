import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  CharacterScoreInput,
  ClearPopulationCharacter,
  FinishedJobRun
} from '@dfragon/database'
import { type NeopleCharacterIdentity, NeopleRequestFailure } from '@dfragon/neople'
import {
  DEFAULT_SCORE_CALCULATION_SCHEDULE,
  SCORE_CALCULATION_JOB_NAME,
  ScoreEngineUnavailable,
  UNAVAILABLE_PAUSE_MS,
  calculateScores,
  createScoreCalculationJob
} from '../src/application/character-score/calculation-job.js'
import type {
  ScoreCalculationDependencies,
  ScoreEngineHandle
} from '../src/application/character-score/ports.js'
import type { CharacterDetailSection } from '../src/domain/character-detail/sections.js'
import type { ScoreEngineResult } from '../src/domain/score/result.js'
import type { WorkerNeople } from '../src/infrastructure/neople/character-collection.js'
import { createScoreSources } from '../src/runtime/score-calculation.js'
import { payloadsFromEngineInput, readEngineInput } from './score-fixtures.js'

const NOW = new Date('2026-11-18T13:00:00Z')

// 합성 캐릭터와 섹션 응답이다. DB는 대상과 저장한 점수를 메모리에 두는 fake이고, 엔진은 캐릭터 ID로 결과를 고르는 fake다.
const character = (characterId: string): ClearPopulationCharacter => ({
  serverId: 'cain',
  characterId,
  maxFame: 70_000,
  jobId: 'synthetic-job',
  jobGrowId: 'synthetic-grow',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터'
})

function sectionOf(
  { serverId, characterId }: NeopleCharacterIdentity,
  section: CharacterDetailSection
) {
  const basic = {
    serverId,
    characterId,
    characterName: `합성-${characterId}`,
    level: 115,
    jobId: 'synthetic-job',
    jobGrowId: 'synthetic-grow',
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    adventureName: '합성모험단',
    fame: 70_000
  }
  const bodies: Record<CharacterDetailSection, Record<string, unknown>> = {
    basic,
    status: { ...basic, status: [], buff: [] },
    equipment: { ...basic, equipment: [], setItemInfo: [] },
    avatar: { ...basic, avatar: [] },
    creature: { ...basic, creature: null },
    oath: { ...basic, oath: null },
    mist_assimilation: { ...basic, mistAssimilation: null },
    skill_style: { ...basic, skill: { style: { active: [] } } },
    buff_equipment: { ...basic, skill: { buff: null } },
    buff_avatar: { ...basic, skill: { buff: null } },
    buff_creature: { ...basic, skill: { buff: null } }
  }

  return bodies[section]
}

const versions = {
  package: 'dnfscore-native 0.4.2',
  rules_rev: 'rev14',
  bundle_id: 'phase32-rev14d'
}

function engineResult(score: number | null): ScoreEngineResult {
  const skipped = score === null ? { kind: 'resolution', message: '판정 불가' } : null

  return {
    calculator: 'equipment',
    score,
    skipped,
    approximate_score: null,
    approximate_source: null,
    warning: null,
    versions,
    display: { role: 'dealer', switchingLevel: null, buff30: null, buff50: null }
  }
}

const scoreOf = (characterId: string): CharacterScoreInput => ({
  serverId: 'cain',
  characterId,
  kind: 'equipment',
  score: 1000 + characterId.charCodeAt(0),
  calculatedAt: NOW,
  engine: { package: versions.package, rulesRev: versions.rules_rev, bundleId: versions.bundle_id }
})

type Respond = (characterId: string, section: CharacterDetailSection, attempt: number) => void

type CalculationOptions = {
  respond?: Respond
  lastRun?: FinishedJobRun
  engine?: 'running' | 'missing' | 'stops-after-first-group'
  unscored?: readonly string[]
}

function calculation(
  targets: readonly ClearPopulationCharacter[],
  options: CalculationOptions = {}
) {
  const { respond = () => undefined, lastRun, engine = 'running', unscored = [] } = options
  const saved: CharacterScoreInput[] = []
  const pauses: number[] = []
  const progress: [number, number][] = []
  const reports: [string, Readonly<Record<string, string | number>>][] = []
  const requested: string[] = []
  const attempts = new Map<string, number>()
  let calculations = 0
  let engineClosed = false
  const neople: Pick<WorkerNeople, 'character' | 'multiItems'> = {
    character: async (identity, section) => {
      requested.push(identity.characterId)
      const key = `${identity.characterId}/${section}`
      const attempt = (attempts.get(key) ?? 0) + 1
      attempts.set(key, attempt)
      respond(identity.characterId, section, attempt)

      return sectionOf(identity, section) as Awaited<ReturnType<WorkerNeople['character']>>
    },
    multiItems: async () => {
      throw new Error('합성 캐릭터는 아이템이 없어 아이템 상세를 부르지 않는다')
    }
  }

  const handle: ScoreEngineHandle = {
    calculate: async (input) => {
      const characterId = String(input.status.characterId)
      calculations++

      if (unscored.includes(characterId)) {
        return engineResult(null)
      }

      return engineResult(scoreOf(characterId).score)
    },
    isRunning: () => engine !== 'stops-after-first-group' || calculations === 0,
    close: async () => {
      engineClosed = true
    }
  }

  const dependencies: ScoreCalculationDependencies = {
    store: {
      readTargets: async () => [...targets],
      readLastFinishedRun: async () => lastRun,
      recordScore: async (score) => {
        saved.push(score)
      }
    },
    openEngine: () => (engine === 'missing' ? null : handle),
    createSources: (onRequest) => createScoreSources(neople, onRequest),
    readConcurrency: () => 2,
    now: () => NOW,
    pause: async (ms) => {
      pauses.push(ms)
    },
    report: (code, details) => {
      reports.push([code, details])
    },
    reportProgress: (done, total) => {
      progress.push([done, total])
    }
  }

  return {
    dependencies,
    saved,
    pauses,
    progress,
    reports,
    requested,
    isEngineClosed: () => engineClosed
  }
}

test('대상의 상세를 받아 계산한 점수를 종류, 계산 시각, 엔진 버전과 함께 저장하고, 없는 캐릭터와 점수를 내지 못한 캐릭터는 건너뛰며 요청 수를 남긴다', async () => {
  const { dependencies, saved, pauses, progress, isEngineClosed } = calculation(
    [character('a'), character('deleted'), character('n')],
    {
      respond: (characterId) => {
        if (characterId === 'deleted') {
          throw new NeopleRequestFailure('api', { characterNotFound: true })
        }
      },
      unscored: ['n']
    }
  )

  const summary = await calculateScores(dependencies)

  assert.deepEqual(saved, [scoreOf('a')])
  // 상세 섹션은 11개이고, 없는 캐릭터는 기본 정보 요청이 실패해 나머지 섹션을 부르지 않는다.
  assert.deepEqual(summary, { characters: 3, resumedAt: 0, saved: 1, skipped: 2, requests: 23 })
  assert.deepEqual(pauses, [])
  assert.deepEqual(progress, [
    [0, 3],
    [2, 3],
    [3, 3]
  ])
  assert.equal(isEngineClosed(), true)
})

for (const kind of ['unavailable', 'timeout'] as const) {
  test(`Neople ${kind} 실패는 건너뛰지 않고 쉬었다가 같은 묶음을 다시 받는다`, async () => {
    const { dependencies, saved, pauses } = calculation(
      [character('a'), character('b'), character('c')],
      {
        respond: (characterId, section, attempt) => {
          if (characterId === 'b' && section === 'equipment' && attempt === 1) {
            throw new NeopleRequestFailure(kind)
          }
        }
      }
    )

    const summary = await calculateScores(dependencies)

    assert.deepEqual(
      saved.map(({ characterId }) => characterId),
      ['a', 'b', 'c']
    )
    assert.equal(summary.saved, 3)
    assert.equal(summary.skipped, 0)
    assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS])
  })
}

test('묶음의 다른 캐릭터는 계산했는데 한 캐릭터만 세 번 연속 unavailable이면 그 캐릭터만 건너뛰고 다음 묶음으로 넘어간다', async () => {
  const { dependencies, saved, pauses, reports } = calculation(
    [character('a'), character('stuck'), character('c')],
    {
      respond: (characterId) => {
        if (characterId === 'stuck') {
          throw new NeopleRequestFailure('unavailable')
        }
      }
    }
  )

  const summary = await calculateScores(dependencies)

  assert.deepEqual(
    saved.map(({ characterId }) => characterId),
    ['a', 'c']
  )
  assert.equal(summary.saved, 2)
  assert.equal(summary.skipped, 1)
  assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS, UNAVAILABLE_PAUSE_MS])
  assert.deepEqual(
    reports.filter(([code]) => code === 'SCORE_CHARACTER_SKIPPED'),
    [['SCORE_CHARACTER_SKIPPED', { position: 1 }]]
  )
})

// 가명 처리한 golden 입력의 섹션과 아이템 상세를 Neople 응답으로 돌려준다. 가짜 엔진은 받은 아이템 상세 수를 점수로 낸다.
async function calculateFixture(
  lookupItems: (itemIds: readonly string[], attempt: number) => string[]
) {
  const original = readEngineInput('dealer-blade')
  const payloads = payloadsFromEngineInput(original)
  const { serverId, characterId } = payloads.basic as Record<string, string>
  const target = { ...character(characterId!), serverId: serverId! }
  const pauses: number[] = []
  const saved: CharacterScoreInput[] = []
  let itemLookups = 0
  const neople: Pick<WorkerNeople, 'character' | 'multiItems'> = {
    character: async (_identity, section) =>
      payloads[section] as Awaited<ReturnType<WorkerNeople['character']>>,
    multiItems: async (itemIds) => {
      itemLookups++
      const rows = lookupItems(itemIds, itemLookups).flatMap(
        (itemId) => original.items[itemId] ?? []
      )

      return { rows } as Awaited<ReturnType<WorkerNeople['multiItems']>>
    }
  }

  const summary = await calculateScores({
    store: {
      readTargets: async () => [target],
      readLastFinishedRun: async () => undefined,
      recordScore: async (score) => {
        saved.push(score)
      }
    },
    openEngine: () => ({
      calculate: async (input) => engineResult(Object.keys(input.items).length),
      isRunning: () => true,
      close: async () => {}
    }),
    createSources: (events) => createScoreSources(neople, events),
    readConcurrency: () => 2,
    now: () => NOW,
    pause: async (ms) => {
      pauses.push(ms)
    },
    report: () => {},
    reportProgress: () => {}
  })

  return { summary, pauses, saved, itemCount: Object.keys(original.items).length }
}

test('아이템 상세 요청이 한도 초과로 실패하면 아이템이 빠진 점수를 버리고 쉬었다가 같은 묶음을 다시 받는다', async () => {
  const { summary, pauses, saved, itemCount } = await calculateFixture((itemIds, attempt) => {
    if (attempt === 1) {
      throw new NeopleRequestFailure('unavailable')
    }

    return [...itemIds]
  })

  assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS])
  assert.equal(summary.saved, 1)
  assert.deepEqual(
    saved.map(({ score }) => score),
    [itemCount]
  )
})

test('응답에 행이 없는 아이템은 다시 받지 않고 상세 조회처럼 그 아이템을 뺀 점수를 저장한다', async () => {
  const [missingItemId] = Object.keys(readEngineInput('dealer-blade').items)
  const { summary, pauses, saved, itemCount } = await calculateFixture((itemIds) =>
    itemIds.filter((itemId) => itemId !== missingItemId)
  )

  assert.deepEqual(pauses, [])
  assert.equal(summary.saved, 1)
  assert.deepEqual(
    saved.map(({ score }) => score),
    [itemCount - 1]
  )
})

const resumeCases: [string, FinishedJobRun | undefined, number][] = [
  ['실행 이력이 없으면 처음부터 계산한다', undefined, 0],
  [
    '하루 안에 실패로 끝난 실행이 있으면 그 진행 위치부터 이어 계산한다',
    { status: 'failed', startedAt: new Date('2026-11-18T03:00:00Z'), progressDone: 2 },
    2
  ],
  [
    '하루 안에 중단된 실행이 있으면 그 진행 위치부터 이어 계산한다',
    { status: 'interrupted', startedAt: new Date('2026-11-18T03:00:00Z'), progressDone: 2 },
    2
  ],
  [
    '마지막 실행이 성공했으면 처음부터 계산한다',
    { status: 'succeeded', startedAt: new Date('2026-11-18T03:00:00Z'), progressDone: 4 },
    0
  ],
  [
    '하루 넘게 지난 실행은 진행 위치가 있어도 처음부터 계산한다',
    { status: 'interrupted', startedAt: new Date('2026-11-17T12:59:00Z'), progressDone: 2 },
    0
  ]
]

for (const [name, lastRun, resumedAt] of resumeCases) {
  test(name, async () => {
    const targets = ['a', 'b', 'c', 'd'].map(character)
    const { dependencies, saved, progress } = calculation(targets, { lastRun })

    const summary = await calculateScores(dependencies)

    assert.deepEqual(
      saved.map(({ characterId }) => characterId),
      targets.slice(resumedAt).map(({ characterId }) => characterId)
    )
    assert.equal(summary.resumedAt, resumedAt)
    assert.deepEqual(progress[0], [resumedAt, 4])
    assert.deepEqual(progress.at(-1), [4, 4])
  })
}

test('엔진 라이브러리 경로 설정이 없으면 Neople을 부르지 않고 이유를 남기며 실패한다', async () => {
  const { dependencies, saved, requested } = calculation([character('a')], { engine: 'missing' })

  await assert.rejects(
    calculateScores(dependencies),
    (error) =>
      error instanceof ScoreEngineUnavailable && error.code === 'SCORE_ENGINE_NOT_CONFIGURED'
  )
  assert.deepEqual(requested, [])
  assert.deepEqual(saved, [])
})

test('엔진 worker가 멈추면 남은 캐릭터를 받지 않고 실패하며 엔진을 닫는다', async () => {
  const { dependencies, saved, requested, isEngineClosed } = calculation(
    ['a', 'b', 'c', 'd'].map(character),
    { engine: 'stops-after-first-group' }
  )

  await assert.rejects(
    calculateScores(dependencies),
    (error) => error instanceof ScoreEngineUnavailable && error.code === 'SCORE_ENGINE_STOPPED'
  )
  assert.deepEqual([...new Set(requested)], ['a', 'b'])
  assert.deepEqual(saved, [])
  assert.equal(isEngineClosed(), true)
})

test('점수 계산 job은 기본으로 수요일 22시에 돌고, 설정한 일정이 있으면 그 일정으로 돌며, 놓친 실행을 보충하지 않는다', () => {
  const { dependencies } = calculation([])
  const { store, openEngine, createSources, readConcurrency, report } = dependencies
  const jobDependencies = { openEngine, createSources, readConcurrency, report }

  const scheduled = createScoreCalculationJob(store, jobDependencies)
  const configured = createScoreCalculationJob(store, jobDependencies, '30 20 * * 3')

  assert.equal(scheduled.name, SCORE_CALCULATION_JOB_NAME)
  assert.equal(scheduled.schedule, DEFAULT_SCORE_CALCULATION_SCHEDULE)
  assert.equal(DEFAULT_SCORE_CALCULATION_SCHEDULE, '0 22 * * 3')
  assert.equal(configured.schedule, '30 20 * * 3')
  assert.equal(scheduled.catchup, false)
})
