import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  CharacterStats,
  FameRankingFilter,
  FameRankingPosition,
  ItemAdoption,
  JobSkillAdoption,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SetAdoption,
  RankedStoredCharacter,
  SetAdoptionQuery
} from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'
import type { RankingStatsRepository } from '../src/application/ranking-stats/repository.js'

// 합성 캐릭터다. DB 읽기는 fake이며 필터, 정렬과 집계는 container-ranking-stats-check.mjs가 실제 DB로 확인한다.
const fetchedAt = new Date('2026-11-06T00:00:00.000Z')
function character(characterId: string, fame: number): RankedStoredCharacter {
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
    dealerSkillLearned: null,
    score: null,
    equipmentSet: null,
    oathSet: null
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

const unusedReader: RankingStatsRepository = {
  readFameRanking: async () => assert.fail('랭킹을 읽으면 안 된다'),
  readCharacterStatsSnapshot: async () => assert.fail('통계를 읽으면 안 된다'),
  readJobSkillAdoptionSnapshot: async () => assert.fail('스킬 채택률을 읽으면 안 된다'),
  readSetAdoption: async () => assert.fail('세트 선택 수를 읽으면 안 된다'),
  readItemAdoption: async () => assert.fail('아이템 선택 수를 읽으면 안 된다')
}

async function listen(
  rankingStats?: RankingStatsRepository
): Promise<{ app: HttpAppHandle; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
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

test('명성 랭킹은 query의 직업과 전직으로 다음 page 확인용 1명을 더해 101명을 읽고 serverId는 무시하며 행에 rank를 붙이지 않는다', async () => {
  const reads: [FameRankingFilter, number, FameRankingPosition | undefined][] = []
  const characters = [
    {
      ...character('a', 80000),
      score: { kind: 'equipment', value: 1234567, approximateSource: null },
      equipmentSet: { id: 'set-fairy', name: '소울 페어리 세트' },
      oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' }
    },
    character('b', 70000)
  ] satisfies RankedStoredCharacter[]
  const scores = [{ calculator: 'equipment', value: 1234567, approximate: null }, null]
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (filter, limit, after) => {
      reads.push([filter, limit, after])

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
        ...character,
        fetchedAt: '2026-11-06T00:00:00.000Z',
        role: 'dealer',
        score: scores[index]
      })),
      nextCursor: null
    })
    assert.equal(all.status, 200)
    assert.deepEqual(reads, [
      [{ jobId: 'synthetic-job', jobGrowId: 'synthetic-grow' }, 101, undefined],
      [{}, 101, undefined]
    ])
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 세트 필터를 직업 필터와 함께 넘긴다', async () => {
  const reads: FameRankingFilter[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (filter) => {
      reads.push(filter)

      return []
    }
  })
  try {
    const query =
      'jobId=synthetic-job&jobGrowId=synthetic-grow&equipmentSetId=set-fairy&oathSetId=16204&oathSetOption=용투'
    const { status } = await getJson(origin, `/rankings/fame?${encodeURI(query)}`)

    assert.equal(status, 200)
    assert.deepEqual(reads, [
      {
        jobId: 'synthetic-job',
        jobGrowId: 'synthetic-grow',
        equipmentSetId: 'set-fairy',
        oathSetId: 16204,
        oathSetOption: '용투'
      }
    ])
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 쉼표로 이은 itemIds를 목록으로 바꿔 세트, 직업 필터와 함께 넘긴다', async () => {
  const reads: FameRankingFilter[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (filter) => {
      reads.push(filter)

      return []
    }
  })
  try {
    const one = await getJson(origin, '/rankings/fame?itemIds=weapon-a')
    const five = await getJson(
      origin,
      '/rankings/fame?jobId=synthetic-job&equipmentSetId=set-fairy&itemIds=a,b,c,d,e'
    )

    assert.equal(one.status, 200)
    assert.deepEqual(one.body, { characters: [], nextCursor: null })
    assert.equal(five.status, 200)
    assert.deepEqual(reads, [
      { itemIds: ['weapon-a'] },
      { jobId: 'synthetic-job', equipmentSetId: 'set-fairy', itemIds: ['a', 'b', 'c', 'd', 'e'] }
    ])
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 fameFrom, fameTo를 숫자로 바꿔 직업 필터와 함께 넘긴다', async () => {
  const reads: FameRankingFilter[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (filter) => {
      reads.push(filter)

      return []
    }
  })

  try {
    const range = await getJson(
      origin,
      '/rankings/fame?jobId=synthetic-job&fameFrom=136000&fameTo=138000'
    )
    const same = await getJson(origin, '/rankings/fame?fameFrom=0&fameTo=0')
    const from = await getJson(origin, '/rankings/fame?fameFrom=136000')

    assert.deepEqual([range.status, same.status, from.status], [200, 200, 200])
    assert.deepEqual(reads, [
      { jobId: 'synthetic-job', fameFrom: 136000, fameTo: 138000 },
      { fameFrom: 0, fameTo: 0 },
      { fameFrom: 136000 }
    ])
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 음수, 소수, 0으로 시작하는 수, 10자리 이상, 빈 값, 중복, fameTo보다 큰 fameFrom을 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)

  try {
    for (const query of [
      'fameFrom=-1',
      'fameFrom=1.5',
      'fameFrom=0136000',
      'fameTo=1000000000',
      'fameFrom=',
      'fameTo=1&fameTo=2',
      'fameFrom=138000&fameTo=136000'
    ]) {
      const { status, body } = await getJson(origin, `/rankings/fame?${query}`)
      assert.equal(status, 400, query)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 빈 itemIds와 빈 항목, 같은 itemId의 중복, 여섯 개 이상, 같은 key의 중복을 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)
  try {
    for (const query of [
      'itemIds=',
      'itemIds=a,',
      'itemIds=a,,b',
      'itemIds=a,a',
      'itemIds=a,b,c,d,e,f',
      'itemIds=a&itemIds=b'
    ]) {
      const { status, body } = await getJson(origin, `/rankings/fame?${query}`)
      assert.equal(status, 400, query)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 쉼표로 이은 스킬 이름~개화 종류 쌍을 개화 목록으로 바꿔 직업, 전직, 세트, 아이템 필터와 함께 넘긴다', async () => {
  const reads: FameRankingFilter[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (filter) => {
      reads.push(filter)

      return []
    }
  })

  try {
    const job = 'jobId=synthetic-job&jobGrowId=synthetic-grow'
    // 운영 데이터의 스킬 이름에 쓰이는 공백, 괄호, 쌍점, 대괄호, 느낌표를 넣은 합성 이름이다.
    const names = ['발도', '귀참 : 나락 (각성) [EX]!', '삼', '사', '오']
    const fivePairs = names.map((name, index) => `${name}~${(index % 2) + 1}`).join(',')
    const one = await getJson(
      origin,
      `/rankings/fame?${job}&evolutions=${encodeURIComponent(`${names[0]}~2`)}`
    )
    const five = await getJson(
      origin,
      `/rankings/fame?${job}&equipmentSetId=set-fairy&itemIds=weapon-a&evolutions=${encodeURIComponent(fivePairs)}`
    )

    assert.deepEqual([one.status, five.status], [200, 200])
    assert.deepEqual(reads, [
      {
        jobId: 'synthetic-job',
        jobGrowId: 'synthetic-grow',
        evolutions: [{ name: '발도', type: 2 }]
      },
      {
        jobId: 'synthetic-job',
        jobGrowId: 'synthetic-grow',
        equipmentSetId: 'set-fairy',
        itemIds: ['weapon-a'],
        evolutions: [
          { name: '발도', type: 1 },
          { name: '귀참 : 나락 (각성) [EX]!', type: 2 },
          { name: '삼', type: 1 },
          { name: '사', type: 2 },
          { name: '오', type: 1 }
        ]
      }
    ])
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 전직 없는 개화, 빈 값과 빈 쌍, 종류가 1, 2가 아니거나 빠진 쌍, 같은 스킬의 중복, 여섯 쌍 이상, 같은 key의 중복을 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)

  try {
    const job = 'jobId=synthetic-job&jobGrowId=synthetic-grow'

    for (const query of [
      'evolutions=발도~1',
      'jobId=synthetic-job&evolutions=발도~1',
      `${job}&evolutions=`,
      `${job}&evolutions=발도~1,`,
      `${job}&evolutions=~1`,
      `${job}&evolutions=발도~3`,
      `${job}&evolutions=발도~0`,
      `${job}&evolutions=발도`,
      `${job}&evolutions=발도~1~2`,
      `${job}&evolutions=발도~1,발도~2`,
      `${job}&evolutions=가~1,나~1,다~1,라~1,마~1,바~1`,
      `${job}&evolutions=발도~1&evolutions=삼~1`
    ]) {
      const { status, body } = await getJson(origin, `/rankings/fame?${encodeURI(query)}`)
      assert.equal(status, 400, query)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})

// fake DB가 받은 위치 뒤의 행만 주도록 해, API가 마지막 행으로 cursor를 만드는지 본다.
test('명성 랭킹은 100명보다 많으면 nextCursor를 주고, 그 cursor로 다음 page를 이어 받으며 마지막 page는 null이다', async () => {
  const sorted = Array.from({ length: 150 }, (_, index) =>
    character(`p${String(index).padStart(3, '0')}`, 90000 - Math.floor(index / 2))
  )
  const afters: (FameRankingPosition | undefined)[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (_filter, limit, after) => {
      afters.push(after)
      const start =
        after === undefined
          ? 0
          : sorted.findIndex((row) => row.characterId === after.characterId) + 1

      return sorted.slice(start, start + limit)
    }
  })
  try {
    const first = await getJson(origin, '/rankings/fame')
    const second = await getJson(
      origin,
      `/rankings/fame?cursor=${encodeURIComponent(first.body.nextCursor)}`
    )
    const ids = [...first.body.characters, ...second.body.characters].map(
      ({ characterId }: { characterId: string }) => characterId
    )

    assert.equal(first.body.characters.length, 100)
    assert.equal(typeof first.body.nextCursor, 'string')
    assert.equal(second.body.characters.length, 50)
    assert.equal(second.body.nextCursor, null)
    assert.deepEqual(
      ids,
      sorted.map(({ characterId }) => characterId)
    )
    assert.deepEqual(afters, [
      undefined,
      { value: 90000 - 49, serverId: 'cain', characterId: 'p099' }
    ])
  } finally {
    await app.close()
  }
})

test('점수 기준 랭킹은 마지막 행의 점수로 cursor를 만들고, 그 cursor는 같은 기준에서만 받는다', async () => {
  const sorted = Array.from({ length: 101 }, (_, index) => ({
    ...character(`s${String(index).padStart(3, '0')}`, 1000),
    score: { kind: 'buff' as const, value: 500000 - Math.floor(index / 2), approximateSource: null }
  }))
  const afters: (FameRankingPosition | undefined)[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (_filter, limit, after) => {
      afters.push(after)
      const start =
        after === undefined
          ? 0
          : sorted.findIndex((row) => row.characterId === after.characterId) + 1

      return sorted.slice(start, start + limit)
    }
  })

  try {
    const first = await getJson(origin, '/rankings/fame?sort=buffScore')
    const cursor = encodeURIComponent(first.body.nextCursor)
    const second = await getJson(origin, `/rankings/fame?sort=buffScore&cursor=${cursor}`)
    const otherSorts = await Promise.all(
      ['', 'sort=fame&', 'sort=equipmentScore&'].map((sort) =>
        getJson(origin, `/rankings/fame?${sort}cursor=${cursor}`)
      )
    )

    assert.deepEqual(
      second.body.characters.map(({ characterId }: { characterId: string }) => characterId),
      ['s100']
    )
    assert.deepEqual(afters, [
      undefined,
      { value: 500000 - 49, serverId: 'cain', characterId: 's099' }
    ])
    assert.deepEqual(
      otherSorts.map(({ status }) => status),
      [400, 400, 400]
    )
  } finally {
    await app.close()
  }
})

test('랭킹은 sort와 scoreFrom, scoreTo를 숫자로 바꿔 직업 필터와 함께 넘긴다', async () => {
  const reads: FameRankingFilter[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readFameRanking: async (filter) => {
      reads.push(filter)

      return []
    }
  })

  try {
    const job = 'jobId=synthetic-job&jobGrowId=synthetic-grow'
    const statuses = await Promise.all(
      [
        `sort=equipmentScore&${job}&scoreFrom=1000000&scoreTo=1200000`,
        'sort=buffScore&scoreFrom=0',
        `sort=fame&${job}&fameFrom=136000`
      ].map(async (query) => (await getJson(origin, `/rankings/fame?${query}`)).status)
    )

    assert.deepEqual(statuses, [200, 200, 200])
    assert.deepEqual(
      reads.toSorted((left, right) => String(left.sort).localeCompare(String(right.sort))),
      [
        { sort: 'buffScore', scoreFrom: 0 },
        {
          sort: 'equipmentScore',
          jobId: 'synthetic-job',
          jobGrowId: 'synthetic-grow',
          scoreFrom: 1000000,
          scoreTo: 1200000
        },
        { sort: 'fame', jobId: 'synthetic-job', jobGrowId: 'synthetic-grow', fameFrom: 136000 }
      ]
    )
  } finally {
    await app.close()
  }
})

test('랭킹은 모르는 sort, 기준과 맞지 않는 범위, scoreTo보다 큰 scoreFrom, 잘못된 점수를 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)

  try {
    for (const query of [
      'sort=score',
      'sort=',
      'scoreFrom=1',
      'sort=fame&scoreTo=1',
      'sort=equipmentScore&fameFrom=1',
      'sort=buffScore&fameTo=1',
      'sort=equipmentScore&scoreFrom=2&scoreTo=1',
      'sort=equipmentScore&scoreFrom=-1',
      'sort=equipmentScore&scoreFrom=1.5',
      'sort=equipmentScore&scoreTo=1000000000',
      'sort=equipmentScore&sort=buffScore'
    ]) {
      const { status, body } = await getJson(origin, `/rankings/fame?${query}`)
      assert.equal(status, 400, query)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})

test('명성 랭킹은 oathSetId 없는 oathSetOption, 숫자가 아닌 oathSetId, 해석할 수 없는 cursor와 빈 세트 값을 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)
  try {
    for (const query of [
      'oathSetOption=%EC%9A%A9%ED%88%AC',
      'oathSetId=abc',
      'oathSetId=0',
      'oathSetId=16204&oathSetId=16205',
      'equipmentSetId=',
      'equipmentSetId=set-a&equipmentSetId=set-b',
      'cursor=',
      'cursor=not-a-cursor',
      `cursor=${Buffer.from('[1,"cain"]').toString('base64url')}`,
      // rank를 넣던 예전 cursor 모양이다.
      `cursor=${Buffer.from('[90000,"cain","p099",100]').toString('base64url')}`
    ]) {
      const { status, body } = await getJson(origin, `/rankings/fame?${query}`)
      assert.equal(status, 400, query)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})

test('명성 랭킹과 세트, 아이템 선택 수는 빈 값, 중복 query와 jobId 없는 jobGrowId를 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)
  try {
    for (const query of [
      'jobId=synthetic-job&jobId=other-job',
      'jobId=',
      'jobGrowId=synthetic-grow'
    ]) {
      for (const path of ['/rankings/fame', '/stats/sets', '/stats/items']) {
        const { status, body } = await getJson(origin, `${path}?${query}`)
        assert.equal(status, 400, `${path}?${query}`)
        assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', `${path}?${query}`)
      }
    }
  } finally {
    await app.close()
  }
})

test('세트, 아이템 선택 수는 목록에 없거나 비었거나 중복인 sample을 400으로 거절한다', async () => {
  const { app, origin } = await listen(unusedReader)
  try {
    for (const query of ['sample=top500', 'sample=', 'sample=top&sample=all']) {
      for (const path of ['/stats/sets', '/stats/items']) {
        const { status, body } = await getJson(origin, `${path}?${query}`)
        assert.equal(status, 400, `${path}?${query}`)
        assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', `${path}?${query}`)
      }
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
      for (const path of ['/rankings/fame', '/stats/skills', '/stats/sets', '/stats/items']) {
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

const setAdoption: SetAdoption = {
  computedAt,
  sampleSize: 3,
  equipmentSets: [
    { setId: 'set-fairy', name: '소울 페어리 세트', count: 2 },
    { setId: null, name: null, count: 1 }
  ],
  oathSets: [
    {
      setId: 16204,
      name: '야망의 용투 서약',
      count: 2,
      options: [{ name: '용투 : 세계를 태우는 불꽃', count: 2 }]
    },
    { setId: null, name: null, count: 1, options: [{ name: null, count: 1 }] }
  ],
  combos: [
    { equipmentSetId: 'set-fairy', oathSetId: 16204, count: 2 },
    { equipmentSetId: null, oathSetId: null, count: 1 }
  ]
}

test('세트 선택 수는 요청마다 query의 표본, 직업, 전직, 남성 크루세이더 role로 저장분을 읽어 계산 시각과 함께 준다', async () => {
  const reads: SetAdoptionQuery[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readSetAdoption: async (query) => {
      reads.push(query)

      return setAdoption
    }
  })
  try {
    const all = await getJson(origin, '/stats/sets')
    const job = await getJson(origin, '/stats/sets?jobId=synthetic-job&sample=fame')
    const dealer = await getJson(origin, `/stats/sets?${maleCrusaderQuery}&role=dealer&sample=top`)

    assert.deepEqual(all, {
      status: 200,
      body: { ...setAdoption, computedAt: '2026-11-06T15:00:00.000Z' }
    })
    assert.equal(job.status, 200)
    assert.equal(dealer.status, 200)
    assert.deepEqual(reads, [
      { sample: 'all' },
      { jobId: 'synthetic-job', sample: 'fame' },
      { jobId: malePriestJobId, jobGrowId: crusaderGrowId, role: 'dealer', sample: 'top' }
    ])
  } finally {
    await app.close()
  }
})

const itemAdoption: ItemAdoption = {
  computedAt,
  sampleSize: 3,
  slots: [
    {
      slotId: 'WEAPON',
      items: [
        { itemId: 'weapon-a', name: '합성 무기', typeDetail: '도', count: 2 },
        { itemId: 'weapon-b', name: '합성 다른 무기', typeDetail: '낫', count: 1 }
      ]
    },
    {
      slotId: 'SUPPORT',
      items: [{ itemId: 'support-a', name: '합성 보조장비', typeDetail: '보조장비', count: 1 }]
    }
  ]
}

test('무기, 유일 장비 선택 수는 요청마다 query의 표본, 직업, 전직, 남성 크루세이더 role로 저장분을 읽어 계산 시각과 함께 준다', async () => {
  const reads: SetAdoptionQuery[] = []
  const { app, origin } = await listen({
    ...unusedReader,
    readItemAdoption: async (query) => {
      reads.push(query)

      return itemAdoption
    }
  })
  try {
    const all = await getJson(origin, '/stats/items')
    const dealer = await getJson(origin, `/stats/items?${maleCrusaderQuery}&role=dealer&sample=top`)

    assert.deepEqual(all, {
      status: 200,
      body: { ...itemAdoption, computedAt: '2026-11-06T15:00:00.000Z' }
    })
    assert.equal(dealer.status, 200)
    assert.deepEqual(reads, [
      { sample: 'all' },
      { jobId: malePriestJobId, jobGrowId: crusaderGrowId, role: 'dealer', sample: 'top' }
    ])
  } finally {
    await app.close()
  }
})

test('DB 설정이 없는 API는 빈 랭킹, 0인 통계와 세트, 아이템 선택 수, computedAt null을 준다', async () => {
  const { app, origin } = await listen()
  try {
    assert.deepEqual(await getJson(origin, '/rankings/fame'), {
      status: 200,
      body: { characters: [], nextCursor: null }
    })
    assert.deepEqual(await getJson(origin, '/stats'), {
      status: 200,
      body: { total: 0, servers: [], jobs: [], fameDistribution: [], computedAt: null }
    })
    assert.deepEqual(await getJson(origin, '/stats/sets?jobId=synthetic-job'), {
      status: 200,
      body: { computedAt: null, sampleSize: 0, equipmentSets: [], oathSets: [], combos: [] }
    })
    assert.deepEqual(await getJson(origin, '/stats/items?jobId=synthetic-job'), {
      status: 200,
      body: { computedAt: null, sampleSize: 0, slots: [] }
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
