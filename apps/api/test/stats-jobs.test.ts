import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  CharacterStats,
  CharacterStatsSnapshot,
  JobSkillAdoption,
  JobSkillAdoptionQuery,
  SkillStyleSampleJob
} from '@dfragon/database'
import type { StatsJobRepository } from '../src/application/ranking-stats/repository.js'
import {
  StatsJobService,
  createCharacterStatsJob,
  createSkillAdoptionJob
} from '../src/application/ranking-stats/stats-jobs.js'

// 합성 값이다. DB 읽기와 저장은 저장 행을 메모리에 두는 fake이며, 실제 DB의 덮어쓰기와 삭제는 container-stats-snapshot-check.mjs가 확인한다.
const stats: CharacterStats = {
  total: 3,
  servers: [{ serverId: 'cain', count: 3 }],
  jobs: [
    {
      jobId: 'synthetic-job',
      jobGrowId: 'synthetic-grow',
      jobName: '귀검사(남)',
      jobGrowName: '眞 웨펀마스터',
      count: 2,
      averageFame: 70000.5
    },
    {
      jobId: 'synthetic-job',
      jobGrowId: 'synthetic-base',
      jobName: '귀검사(남)',
      jobGrowName: '없음',
      count: 1,
      averageFame: null
    }
  ],
  fameDistribution: [{ from: 70000, to: 71000, count: 2 }]
}

// Neople /df/jobs의 프리스트(남)와 眞 크루세이더 ID다.
const maleCrusader = {
  jobId: 'f6a4ad30555b99b499c07835f87ce522',
  jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
}
const weaponMaster = { jobId: 'synthetic-job', jobGrowId: 'synthetic-grow' }
const blade = { jobId: 'synthetic-job', jobGrowId: 'synthetic-blade' }

const adoptionFor = ({ jobGrowId, role }: JobSkillAdoptionQuery): JobSkillAdoption => ({
  minFame: 70000,
  sampleSize: 1,
  skills: [{ name: `${jobGrowId}:${role ?? 'all'}`, learned: 1, levels: [[1, 1]] }],
  evolutions: [],
  enhancements: []
})

function minutesAfterMidnight(minutes: number): Date {
  return new Date(Date.UTC(2026, 10, 10, 15, minutes))
}

function sequentialClock() {
  let minutes = 0

  return () => minutesAfterMidnight(minutes++)
}

function memoryStatsStore({
  famedJobGrows = [] as SkillStyleSampleJob[],
  failOn = undefined as string | undefined
} = {}) {
  const savedStats: CharacterStatsSnapshot[] = []
  const adoptionRows = new Map<string, { computedAt: Date; adoption: JobSkillAdoption }>()
  const store: StatsJobRepository = {
    readCharacterStats: async () => stats,
    saveCharacterStats: async (snapshot) => {
      savedStats.splice(0, savedStats.length, snapshot)
    },
    readFamedJobGrows: async () => famedJobGrows,
    readJobSkillAdoption: async (job) => {
      if (job.jobGrowId === failOn) {
        throw new Error('synthetic read failure')
      }

      return adoptionFor(job)
    },
    saveJobSkillAdoption: async ({ jobId, jobGrowId, role, computedAt, adoption }) => {
      adoptionRows.set(`${jobId}/${jobGrowId}/${role ?? 'all'}`, { computedAt, adoption })
    },
    deleteJobSkillAdoptionComputedBefore: async (before) => {
      let deleted = 0
      for (const [key, { computedAt }] of adoptionRows) {
        if (computedAt < before) {
          adoptionRows.delete(key)
          deleted++
        }
      }

      return deleted
    }
  }

  return { store, savedStats, adoptionRows }
}

const ignoreProgress = { reportProgress: () => {} }

test('통계 job은 계산을 시작한 시각과 직업별 평균 명성을 반올림한 통계를 저장한다', async () => {
  const { store, savedStats } = memoryStatsStore()
  const clock = sequentialClock()
  // 계산 중에 시계를 한 칸 진행해, 계산을 끝낸 시각을 저장하면 실패하게 한다.
  const readWhileTimePasses = async () => {
    clock()

    return store.readCharacterStats()
  }
  const job = createCharacterStatsJob(
    new StatsJobService({ ...store, readCharacterStats: readWhileTimePasses }, clock)
  )

  const summary = await job.run({}, ignoreProgress)

  assert.deepEqual(savedStats, [
    {
      computedAt: minutesAfterMidnight(0),
      total: 3,
      servers: [{ serverId: 'cain', count: 3 }],
      jobs: [
        { ...stats.jobs[0], averageFame: 70001 },
        { ...stats.jobs[1], averageFame: null }
      ],
      fameDistribution: [{ from: 70000, to: 71000, count: 2 }]
    }
  ])
  assert.deepEqual(summary, { total: 3 })
})

test('스킬 채택률 job은 전직마다 저장하고 남성 크루세이더는 전체, 딜러, 버퍼를 따로 저장한다', async () => {
  const { store, adoptionRows } = memoryStatsStore({ famedJobGrows: [weaponMaster, maleCrusader] })
  const job = createSkillAdoptionJob(new StatsJobService(store, sequentialClock()))
  const progress: [number, number | undefined][] = []

  await job.run({}, { reportProgress: (done, total) => progress.push([done, total]) })

  const crusaderKey = `${maleCrusader.jobId}/${maleCrusader.jobGrowId}`
  assert.deepEqual(
    [...adoptionRows.keys()].sort(),
    [
      `${crusaderKey}/all`,
      `${crusaderKey}/buffer`,
      `${crusaderKey}/dealer`,
      'synthetic-job/synthetic-grow/all'
    ].sort()
  )
  assert.deepEqual(
    adoptionRows.get(`${crusaderKey}/dealer`)?.adoption,
    adoptionFor({ ...maleCrusader, role: 'dealer' })
  )
  assert.deepEqual(progress, [
    [0, 2],
    [1, 2],
    [2, 2]
  ])
})

test('다시 돌리면 행을 덮어쓰고 명성 있는 캐릭터가 없어진 전직의 행만 지운다', async () => {
  const famedJobGrows = [weaponMaster, blade]
  const { store, adoptionRows } = memoryStatsStore({ famedJobGrows })
  const job = createSkillAdoptionJob(new StatsJobService(store, sequentialClock()))
  await job.run({}, ignoreProgress)
  const firstComputedAt = adoptionRows.get('synthetic-job/synthetic-grow/all')?.computedAt

  famedJobGrows.splice(1, 1)
  const summary = await job.run({}, ignoreProgress)

  assert.deepEqual([...adoptionRows.keys()], ['synthetic-job/synthetic-grow/all'])
  assert.notDeepEqual(
    adoptionRows.get('synthetic-job/synthetic-grow/all')?.computedAt,
    firstComputedAt
  )
  assert.deepEqual(summary, { jobGrows: 1, deleted: 1 })
})

test('중간 전직의 계산이 실패하면 지난 실행의 행을 지우지 않는다', async () => {
  const { store, adoptionRows } = memoryStatsStore({
    famedJobGrows: [weaponMaster, blade],
    failOn: blade.jobGrowId
  })
  adoptionRows.set('synthetic-job/old-grow/all', {
    computedAt: minutesAfterMidnight(-60),
    adoption: adoptionFor(blade)
  })

  await assert.rejects(
    createSkillAdoptionJob(new StatsJobService(store, sequentialClock())).run({}, ignoreProgress)
  )

  assert.ok(adoptionRows.has('synthetic-job/old-grow/all'))
})
