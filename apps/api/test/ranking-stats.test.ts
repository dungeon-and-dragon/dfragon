import assert from 'node:assert/strict'
import test from 'node:test'
import type { CharacterStats, FameRankingFilter, StoredCharacter } from '@dfragon/database'
import type { INestApplication } from '@nestjs/common'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createApiHttpApp } from '../src/http.js'
import { type RankingStatsReader, createRankingStatsService } from '../src/ranking-stats/service.js'

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
    fetchedAt
  }
}

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
  fameDistribution: [{ from: 70000, to: 80000, count: 2 }]
}

const unusedReader: RankingStatsReader = {
  readFameRanking: async () => assert.fail('랭킹을 읽으면 안 된다'),
  readCharacterStats: async () => assert.fail('통계를 읽으면 안 된다')
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
      characters: [
        { rank: 1, ...characters[0], fetchedAt: '2026-11-06T00:00:00.000Z' },
        { rank: 2, ...characters[1], fetchedAt: '2026-11-06T00:00:00.000Z' }
      ]
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

test('통계는 직업별 평균 명성을 반올림하고 같은 날(KST)에는 DB를 한 번만 읽는다', async () => {
  let reads = 0
  // 2026-11-06 23:59 KST에 처음 계산하고, 1분 뒤인 다음 날 0시에 다시 계산해야 한다.
  let now = new Date('2026-11-06T14:59:00.000Z')
  const service = createRankingStatsService(
    {
      ...unusedReader,
      readCharacterStats: async () => {
        reads += 1

        return stats
      }
    },
    () => now
  )

  const [first, concurrent] = await Promise.all([service.stats(), service.stats()])
  now = new Date('2026-11-06T14:59:59.999Z')
  const sameDay = await service.stats()

  assert.equal(reads, 1)
  assert.equal(concurrent, first)
  assert.equal(sameDay, first)
  assert.deepEqual(first, {
    ...stats,
    jobs: [
      { ...stats.jobs[0], averageFame: 70001 },
      { ...stats.jobs[1], averageFame: null }
    ],
    computedAt: '2026-11-06T14:59:00.000Z'
  })

  now = new Date('2026-11-06T15:00:00.000Z')
  const nextDay = await service.stats()

  assert.equal(reads, 2)
  assert.equal(nextDay.computedAt, '2026-11-06T15:00:00.000Z')
})

test('0시(KST) 직전에 시작해 0시 뒤에 끝난 통계는 다음 요청이 다시 계산한다', async () => {
  let reads = 0
  let finishRead: (() => void) | undefined
  let now = new Date('2026-11-06T14:59:59.000Z')
  const service = createRankingStatsService(
    {
      ...unusedReader,
      readCharacterStats: async () => {
        reads += 1
        if (reads === 1) {
          await new Promise<void>((resolve) => {
            finishRead = resolve
          })
        }

        return stats
      }
    },
    () => now
  )

  const first = service.stats()
  await Promise.resolve()
  now = new Date('2026-11-06T15:00:01.000Z')
  finishRead?.()
  assert.equal((await first).computedAt, '2026-11-06T14:59:59.000Z')
  const next = await service.stats()

  assert.equal(reads, 2)
  assert.equal(next.computedAt, '2026-11-06T15:00:01.000Z')
})

test('통계 계산이 실패하면 500을 주고 실패를 캐시하지 않는다', async () => {
  let reads = 0
  const { app, origin } = await listen({
    ...unusedReader,
    readCharacterStats: async () => {
      reads += 1
      if (reads === 1) {
        throw new Error('synthetic database failure')
      }

      return stats
    }
  })
  try {
    const failed = await getJson(origin, '/stats')
    const retried = await getJson(origin, '/stats')

    assert.equal(failed.status, 500)
    assert.equal(failed.body.error.code, 'INTERNAL_SERVER_ERROR')
    assert.equal(retried.status, 200)
    assert.equal(retried.body.total, 3)
    assert.equal(reads, 2)
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

test('DB 설정이 없는 API는 빈 랭킹과 0인 통계를 준다', async () => {
  const { app, origin } = await listen()
  try {
    assert.deepEqual(await getJson(origin, '/rankings/fame'), {
      status: 200,
      body: { characters: [] }
    })
    const { status, body } = await getJson(origin, '/stats')

    assert.equal(status, 200)
    assert.deepEqual(
      { ...body, computedAt: undefined },
      { total: 0, servers: [], jobs: [], fameDistribution: [], computedAt: undefined }
    )
    assert.ok(!Number.isNaN(Date.parse(body.computedAt)))
  } finally {
    await app.close()
  }
})
