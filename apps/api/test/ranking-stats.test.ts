import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  CharacterStats,
  FameRankingFilter,
  JobSkillAdoption,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  StoredCharacter
} from '@dfragon/database'
import type { INestApplication } from '@nestjs/common'
import { createCatalogService } from '../src/application/character-catalog/service.js'
import { createApiHttpApp } from '../src/http.js'
import type { RankingStatsReader } from '../src/application/ranking-stats/ports.js'

// 합성 캐릭터다. DB 읽기는 fake이며 필터, 정렬과 집계는 container-ranking-stats-check.mjs가 실제 DB로 확인한다.
const fetchedAt = new Date('2026-11-06T00:00:00.000Z')
function character(characterId: string, fame: number): StoredCharacter {
  return {
    serverId: 'cain',
    characterId,
    characterName: `합성${characterId}`,
    adventureName: '합성모험단',
    level: 115,
    jobId: 'synthetic-job',
    jobGrowId: 'synthetic-grow',
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    fame,
    guildId: null,
    guildName: null,
    fetchedAt,
    dealerSkillLearned: null
  }
}

// Neople /df/jobs의 프리스트(남), 프리스트(여)와 眞 크루세이더 ID다.
const malePriestJobId = 'f6a4ad30555b99b499c07835f87ce522'
const femalePriestJobId = '0c1b401bb09241570d364420b3ba3fd7'
const crusaderGrowId = '37495b941da3b1661bc900e68ef3b2c6'
const maleCrusaderQuery = `jobId=${malePriestJobId}&jobGrowId=${crusaderGrowId}`

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
      averageFame: 70001
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

const adoption: JobSkillAdoption = {
  minFame: 70000,
  sampleSize: 2,
  skills: [
    {
      name: '발도',
      learned: 2,
      levels: [
        [1, 1],
        [13, 1]
      ]
    }
  ],
  evolutions: [{ name: '발도', type1: 1, type2: 1 }],
  enhancements: [{ name: '발도', type1: 0, type2: 2 }]
}

const computedAt = new Date('2026-11-06T15:00:00.000Z')

function adoptionSnapshot(job: JobSkillAdoptionQuery): JobSkillAdoptionSnapshot {
  return { ...job, computedAt, adoption }
}

const unusedReader: RankingStatsReader = {
  readFameRanking: async () => assert.fail('랭킹을 읽으면 안 된다'),
  readCharacterStatsSnapshot: async () => assert.fail('통계를 읽으면 안 된다'),
  readJobSkillAdoptionSnapshot: async () => assert.fail('스킬 채택률을 읽으면 안 된다')
}

async function listen(
  rankingStats?: RankingStatsReader
): Promise<{ app: INestApplication; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    rankingStats,
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
}

async function getJson(origin: string, path: string) {
  const response = await fetch(new URL(path, origin))
  const body = await response.json()

  return { status: response.status, body }
}

test('명성 랭킹은 query의 직업과 전직, limit 100으로 읽고 serverId는 무시하며 1부터 rank를 붙인다', async () => {
  const reads: [FameRankingFilter, number][] = []
  const characters = [character('a', 80000), character('b', 70000)]
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (filter, limit) => {
      reads.push([filter, limit])

      return characters
    }
  })
  try {
    const answer = await getJson(
      origin,
      '/rankings/fame?serverId=cain&jobId=synthetic-job&jobGrowId=synthetic-grow'
    )
    const all = await getJson(origin, '/rankings/fame')

    assert.equal(answer.status, 200)
    assert.deepEqual(answer.body, {
      characters: characters.map(({ dealerSkillLearned, ...character }, index) => ({
        rank: index + 1,
        ...character,
        fetchedAt: '2026-11-06T00:00:00.000Z',
        role: 'dealer'
      }))
    })
    assert.equal(all.status, 200)
    assert.deepEqual(reads, [
      [{ jobId: 'synthetic-job', jobGrowId: 'synthetic-grow' }, 100],
      [{}, 100]
    ])
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 빈 값, 중복 query와 jobId 없는 jobGrowId를 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)
  try {
    for (const query of [
      'jobId=synthetic-job&jobId=other-job',
      'jobId=',
      'jobGrowId=synthetic-grow'
    ]) {
      const { status, body } = await getJson(origin, `/rankings/fame?${query}`)
      assert.equal(status, 400, query)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})

test('명성 랭킹과 스킬 채택률은 남성 크루세이더의 role을 그대로 넘긴다', async () => {
  const rankingReads: FameRankingFilter[] = []
  const adoptionReads: JobSkillAdoptionQuery[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (filter) => {
      rankingReads.push(filter)

      return []
    },
    readJobSkillAdoptionSnapshot: async (job) => {
      adoptionReads.push(job)

      return adoptionSnapshot(job)
    }
  })
  try {
    for (const role of ['dealer', 'buffer']) {
      assert.equal(
        (await getJson(origin, `/rankings/fame?${maleCrusaderQuery}&role=${role}`)).status,
        200
      )
      assert.equal(
        (await getJson(origin, `/stats/skills?${maleCrusaderQuery}&role=${role}`)).status,
        200
      )
    }

    const maleCrusader = { jobId: malePriestJobId, jobGrowId: crusaderGrowId }
    assert.deepEqual(rankingReads, [
      { ...maleCrusader, role: 'dealer' },
      { ...maleCrusader, role: 'buffer' }
    ])
    assert.deepEqual(adoptionReads, [
      { ...maleCrusader, role: 'dealer' },
      { ...maleCrusader, role: 'buffer' }
    ])
  } finally {
    await app.close()
  }
})

test('role은 남성 크루세이더 전직이 아니거나 값이 다르거나 중복이면 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)
  try {
    for (const query of [
      `jobId=${femalePriestJobId}&jobGrowId=${crusaderGrowId}&role=dealer`,
      `jobId=${malePriestJobId}&jobGrowId=618326026de1a1f1cfba5dbd0b8396e7&role=dealer`,
      `jobId=${malePriestJobId}&role=buffer`,
      'role=dealer',
      `${maleCrusaderQuery}&role=synergy`,
      `${maleCrusaderQuery}&role=`,
      `${maleCrusaderQuery}&role=dealer&role=buffer`
    ]) {
      for (const path of ['/rankings/fame', '/stats/skills']) {
        const { status, body } = await getJson(origin, `${path}?${query}`)
        assert.equal(status, 400, `${path}?${query}`)
        assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', `${path}?${query}`)
      }
    }
  } finally {
    await app.close()
  }
})

test('통계는 요청마다 저장분을 읽어 저장된 값과 계산 시각을 준다', async () => {
  let stored = { ...stats, computedAt }
  const { app, origin } = await listen({
    ...unusedReader,
    readCharacterStatsSnapshot: async () => stored
  })
  try {
    const first = await getJson(origin, '/stats')
    const nextComputedAt = new Date('2026-11-07T15:00:00.000Z')
    stored = { ...stats, total: 4, computedAt: nextComputedAt }
    const next = await getJson(origin, '/stats')

    assert.deepEqual(first, {
      status: 200,
      body: { ...stats, computedAt: '2026-11-06T15:00:00.000Z' }
    })
    assert.deepEqual(next, {
      status: 200,
      body: { ...stats, total: 4, computedAt: '2026-11-07T15:00:00.000Z' }
    })
  } finally {
    await app.close()
  }
})

test('통계 저장분이 없으면 0과 빈 목록, computedAt null을 준다', async () => {
  const { app, origin } = await listen({
    ...unusedReader,
    readCharacterStatsSnapshot: async () => null
  })
  try {
    assert.deepEqual(await getJson(origin, '/stats'), {
      status: 200,
      body: { total: 0, servers: [], jobs: [], fameDistribution: [], computedAt: null }
    })
  } finally {
    await app.close()
  }
})

test('통계 저장분 읽기가 실패하면 500 INTERNAL_SERVER_ERROR를 준다', async () => {
  const { app, origin } = await listen({
    ...unusedReader,
    readCharacterStatsSnapshot: async () => {
      throw new Error('synthetic database failure')
    }
  })
  try {
    const { status, body } = await getJson(origin, '/stats')

    assert.equal(status, 500)
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR')
  } finally {
    await app.close()
  }
})

test('명성 랭킹 DB 읽기가 실패하면 500 INTERNAL_SERVER_ERROR를 준다', async () => {
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async () => {
      throw new Error('synthetic database failure')
    }
  })
  try {
    const { status, body } = await getJson(origin, '/rankings/fame')

    assert.equal(status, 500)
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR')
  } finally {
    await app.close()
  }
})

test('DB 설정이 없는 API는 빈 랭킹과 0인 통계, computedAt null을 준다', async () => {
  const { app, origin } = await listen()
  try {
    assert.deepEqual(await getJson(origin, '/rankings/fame'), {
      status: 200,
      body: { characters: [] }
    })
    assert.deepEqual(await getJson(origin, '/stats'), {
      status: 200,
      body: { total: 0, servers: [], jobs: [], fameDistribution: [], computedAt: null }
    })
  } finally {
    await app.close()
  }
})

test('스킬 채택률은 요청마다 그 전직의 저장분을 읽어 저장된 값, 계산 시각과 topCount를 준다', async () => {
  const reads: JobSkillAdoptionQuery[] = []
  let sampleSize = adoption.sampleSize
  const { app, origin } = await listen({
    ...unusedReader,
    readJobSkillAdoptionSnapshot: async (job) => {
      reads.push(job)

      return { ...job, computedAt, adoption: { ...adoption, sampleSize } }
    }
  })
  try {
    const path = '/stats/skills?jobId=synthetic-job&jobGrowId=synthetic-grow'
    const first = await getJson(origin, path)
    sampleSize = 3
    const next = await getJson(origin, path)

    assert.deepEqual(first, {
      status: 200,
      body: { computedAt: '2026-11-06T15:00:00.000Z', topCount: 5000, ...adoption }
    })
    assert.equal(next.body.sampleSize, 3)
    const job = { jobId: 'synthetic-job', jobGrowId: 'synthetic-grow' }
    assert.deepEqual(reads, [job, job])
  } finally {
    await app.close()
  }
})

test('스킬 채택률 저장분이 없는 전직은 표본 0인 빈 값과 computedAt null을 준다', async () => {
  const { app, origin } = await listen({
    ...unusedReader,
    readJobSkillAdoptionSnapshot: async () => null
  })
  try {
    assert.deepEqual(
      await getJson(origin, '/stats/skills?jobId=unknown-job&jobGrowId=unknown-grow'),
      {
        status: 200,
        body: {
          computedAt: null,
          topCount: 5000,
          minFame: null,
          sampleSize: 0,
          skills: [],
          evolutions: [],
          enhancements: []
        }
      }
    )
  } finally {
    await app.close()
  }
})

test('스킬 채택률 저장분 읽기가 실패하면 500 INTERNAL_SERVER_ERROR를 준다', async () => {
  const { app, origin } = await listen({
    ...unusedReader,
    readJobSkillAdoptionSnapshot: async () => {
      throw new Error('synthetic database failure')
    }
  })
  try {
    const { status, body } = await getJson(
      origin,
      '/stats/skills?jobId=synthetic-job&jobGrowId=synthetic-grow'
    )

    assert.equal(status, 500)
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR')
  } finally {
    await app.close()
  }
})

test('스킬 채택률은 빈 값, 중복 query와 빠진 jobId, jobGrowId를 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)
  try {
    for (const query of [
      'jobId=synthetic-job',
      'jobGrowId=synthetic-grow',
      'jobId=&jobGrowId=synthetic-grow',
      'jobId=synthetic-job&jobGrowId=',
      'jobId=synthetic-job&jobId=other-job&jobGrowId=synthetic-grow',
      'jobId=synthetic-job&jobGrowId=synthetic-grow&jobGrowId=other-grow'
    ]) {
      const { status, body } = await getJson(origin, `/stats/skills?${query}`)
      assert.equal(status, 400, query)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})

test('DB 설정이 없는 API는 표본 0인 빈 스킬 채택률과 computedAt null을 준다', async () => {
  const { app, origin } = await listen()
  try {
    assert.deepEqual(
      await getJson(origin, '/stats/skills?jobId=synthetic-job&jobGrowId=synthetic-grow'),
      {
        status: 200,
        body: {
          computedAt: null,
          topCount: 5000,
          minFame: null,
          sampleSize: 0,
          skills: [],
          evolutions: [],
          enhancements: []
        }
      }
    )
  } finally {
    await app.close()
  }
})
