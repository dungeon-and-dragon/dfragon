import assert from 'node:assert/strict'
import test from 'node:test'
import type { CollectedCharacter } from '@dfragon/database'
import { type CharactersFameQuery, NeopleRequestFailure } from '@dfragon/neople'
import {
  CharacterDiscoveryService,
  UNAVAILABLE_PAUSE_MS,
  createCharacterDiscoveryJob
} from '../src/application/character-collection/discovery.js'
import { CharacterCollectionFailure } from '../src/domain/character-collection/failure.js'
import {
  FAME_SEARCH_LIMIT,
  FAME_SEARCH_RANGE,
  nextMaxFame
} from '../src/domain/character-collection/fame-sweep.js'
import { createNeopleFameSearch } from '../src/infrastructure/neople/character-discovery.js'

type SyntheticCharacter = CollectedCharacter & { jobGrowId: string; fame: number }

type FameRequest = CharactersFameQuery & { serverId: string }

// 합성 서버와 직업이다. 직업 목록의 1차 전직마다 검색 대상이 하나씩 생긴다.
const SERVERS = ['cain', 'siroco']
const JOBS = [
  { jobId: 'job-a', rows: [{ jobGrowId: 'grow-a1' }, { jobGrowId: 'grow-a2' }] },
  { jobId: 'job-b', rows: [{ jobGrowId: 'grow-b1' }] }
]
const TARGET_COUNT = 6

function charactersOf(
  serverId: string,
  jobGrowId: string,
  fames: readonly number[]
): SyntheticCharacter[] {
  return fames.map((fame, index) => ({
    serverId,
    characterId: `${serverId}-${jobGrowId}-${index}`,
    jobGrowId,
    fame
  }))
}

const idsOf = (characters: readonly CollectedCharacter[]) =>
  characters.map(({ serverId, characterId }) => `${serverId}/${characterId}`).sort()

// 문서의 제약(명성 범위 2,000, 요청한 limit까지, 명성 내림차순)대로 답하는 가짜 Neople이고, 대기열은 메모리에 둔다.
function discovery(
  population: readonly SyntheticCharacter[],
  fail: (request: FameRequest, attempt: number) => Error | undefined = () => undefined,
  lowerBound: 'inclusive' | 'exclusive' = 'inclusive'
) {
  const queued: CollectedCharacter[] = []
  const pauses: number[] = []
  const requests: FameRequest[] = []
  const reports: [string, Readonly<Record<string, string | number>>][] = []
  const progress: [number, number][] = []
  const attempts = new Map<string, number>()
  const ports = createNeopleFameSearch({
    servers: async () => {
      const rows = SERVERS.map((serverId) => ({ serverId }))

      return { rows }
    },
    jobs: async () => ({ rows: JOBS }),
    charactersFame: async (serverId, query) => {
      const request = { serverId, ...query }
      const key = JSON.stringify(request)
      const attempt = (attempts.get(key) ?? 0) + 1
      attempts.set(key, attempt)
      requests.push(request)

      const failure = fail(request, attempt)
      if (failure !== undefined) {
        throw failure
      }

      const maxFame = query.maxFame ?? Math.max(...population.map(({ fame }) => fame))
      const minFame = query.minFame ?? maxFame - FAME_SEARCH_RANGE
      assert.ok(maxFame - minFame <= FAME_SEARCH_RANGE)

      const reachesMinFame = (fame: number) => {
        if (lowerBound === 'exclusive') {
          return fame > minFame
        }

        return fame >= minFame
      }
      const rows = population
        .filter(
          (character) =>
            (serverId === 'all' || character.serverId === serverId) &&
            (query.jobGrowId === undefined || character.jobGrowId === query.jobGrowId) &&
            reachesMinFame(character.fame) &&
            character.fame <= maxFame
        )
        .sort((left, right) => right.fame - left.fame)
        .slice(0, query.limit)
        .map(({ characterId, fame }) => ({ characterId, fame }))

      return { rows }
    }
  })
  const service = new CharacterDiscoveryService(
    {
      enqueue: async (characters) => {
        queued.push(...characters)
      }
    },
    {
      ...ports,
      readConcurrency: () => 2,
      pause: async (ms) => {
        pauses.push(ms)
      },
      report: (code, details) => {
        reports.push([code, details])
      }
    }
  )
  const discover = () =>
    service.discover((done, total) => {
      progress.push([done, total])
    })

  return { service, discover, queued, pauses, requests, reports, progress }
}

test('서버와 1차 전직마다 최고 명성에서 0까지 내려가며 찾은 캐릭터를 모두 대기열에 넣는다', async () => {
  const population = [
    ...charactersOf('cain', 'grow-a1', [50_000, 49_999, 31_337]),
    ...charactersOf('cain', 'grow-a2', [12_345]),
    ...charactersOf('siroco', 'grow-b1', [47_001, 1])
  ]
  const { discover, queued, pauses, requests, progress } = discovery(population)

  const summary = await discover()

  assert.deepEqual(idsOf(queued), idsOf(population))
  assert.deepEqual(summary, { targets: TARGET_COUNT, skipped: 0, listed: population.length })
  assert.deepEqual(pauses, [])
  assert.deepEqual(progress.at(-1), [TARGET_COUNT, TARGET_COUNT])
  assert.deepEqual(
    requests.find(({ serverId, jobGrowId }) => serverId === 'siroco' && jobGrowId === 'grow-b1'),
    {
      serverId: 'siroco',
      minFame: 48_000,
      maxFame: 50_000,
      jobId: 'job-b',
      jobGrowId: 'grow-b1',
      isAllJobGrow: true,
      limit: FAME_SEARCH_LIMIT
    }
  )
})

test('한 구간에 한 번에 받는 수보다 많은 캐릭터가 있어도 가장 낮은 명성부터 이어 받아 모두 찾는다', async () => {
  // 명성 2,000 범위 안에 650명을 두고, 같은 명성을 가진 캐릭터도 셋씩 둔다.
  const crowded = Array.from({ length: 650 }, (_, index) => 49_900 - Math.floor(index / 3))
  const population = [
    ...charactersOf('cain', 'grow-a1', crowded),
    ...charactersOf('cain', 'grow-a2', [50_000])
  ]
  const { discover, queued } = discovery(population)

  await discover()

  assert.deepEqual([...new Set(idsOf(queued))], idsOf(population))
})

test('Neople이 구간의 최소 명성을 빼고 답해도 경계 명성의 캐릭터를 다음 구간에서 찾는다', async () => {
  const population = charactersOf('cain', 'grow-a1', [50_000, 48_000, 46_000])
  const { discover, queued } = discovery(population, undefined, 'exclusive')

  await discover()

  assert.deepEqual(idsOf(queued), idsOf(population))
})

test('한 명성에 한 번에 받는 수보다 많은 캐릭터가 몰리면 받은 만큼만 넣고 그 아래 명성으로 내려간다', async () => {
  const population = charactersOf('cain', 'grow-a1', [
    ...Array.from({ length: FAME_SEARCH_LIMIT + 50 }, () => 40_000),
    39_999,
    5
  ])
  const tied = population.filter(({ fame }) => fame === 40_000)
  const lower = population.filter(({ fame }) => fame < 40_000)
  const { discover, queued } = discovery(population)

  await discover()

  const found = new Set(idsOf(queued))
  const foundTied = tied.filter(({ characterId }) => found.has(`cain/${characterId}`))
  assert.equal(foundTied.length, FAME_SEARCH_LIMIT)
  assert.deepEqual(
    idsOf(lower).filter((id) => found.has(id)),
    idsOf(lower)
  )
})

for (const kind of ['unavailable', 'timeout'] as const) {
  test(`명성 검색이 ${kind}로 실패하면 쉬었다가 같은 구간을 다시 받는다`, async () => {
    const population = charactersOf('cain', 'grow-a1', [50_000, 19_999])
    const { discover, queued, pauses, reports } = discovery(population, (request, attempt) => {
      const failing =
        request.serverId === 'cain' && request.jobGrowId === 'grow-a1' && request.maxFame === 20_000

      if (failing && attempt === 1) {
        return new NeopleRequestFailure(kind)
      }

      return undefined
    })

    const summary = await discover()

    assert.deepEqual(idsOf(queued), idsOf(population))
    assert.equal(summary.skipped, 0)
    assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS])
    assert.deepEqual(reports, [
      [
        'CHARACTER_DISCOVERY_NEOPLE_UNAVAILABLE',
        { serverId: 'cain', jobId: 'job-a', jobGrowId: 'grow-a1', maxFame: 20_000 }
      ]
    ])
  })
}

test('명성 검색이 그 밖의 실패로 답한 서버와 전직만 건너뛰고 나머지는 끝까지 찾는다', async () => {
  const broken = charactersOf('cain', 'grow-a2', [50_000, 10])
  const healthy = charactersOf('siroco', 'grow-b1', [30_001])
  const { discover, queued, pauses, reports } = discovery([...broken, ...healthy], (request) => {
    const failing = request.jobGrowId === 'grow-a2' && request.maxFame === 48_000

    if (failing) {
      return new NeopleRequestFailure('api')
    }

    return undefined
  })

  const summary = await discover()

  assert.deepEqual(idsOf(queued), idsOf([...broken.slice(0, 1), ...healthy]))
  assert.equal(summary.skipped, SERVERS.length)
  assert.deepEqual(pauses, [])
  assert.deepEqual(
    reports.map(([code, { serverId, maxFame }]) => [code, serverId, maxFame]),
    [
      ['CHARACTER_DISCOVERY_TARGET_SKIPPED', 'cain', 48_000],
      ['CHARACTER_DISCOVERY_TARGET_SKIPPED', 'siroco', 48_000]
    ]
  )
})

test('최고 명성을 받지 못하면 아무것도 넣지 않고 실패 종류를 담아 던진다', async () => {
  const { discover, queued } = discovery(charactersOf('cain', 'grow-a1', [50_000]), (request) => {
    if (request.serverId === 'all') {
      return new NeopleRequestFailure('unavailable')
    }

    return undefined
  })

  await assert.rejects(discover(), (error) => {
    assert.ok(error instanceof CharacterCollectionFailure)
    assert.equal(error.kind, 'unavailable')

    return true
  })
  assert.deepEqual(queued, [])
})

test('다음 최대 명성: 덜 찬 구간은 구간의 최소 명성으로, 꽉 찬 구간은 받은 가장 낮은 명성으로 내려간다', () => {
  const full = (fame: number) => Array.from({ length: FAME_SEARCH_LIMIT }, () => fame)
  const fullAbove = [...full(49_500).slice(1), 49_200]
  const fullAtMax = full(50_000)
  const fullAtZero = full(0)
  const cases = [
    {
      name: '덜 찬 구간',
      window: { minFame: 48_000, maxFame: 50_000 },
      fames: [49_000],
      next: 48_000
    },
    { name: '빈 구간', window: { minFame: 48_000, maxFame: 50_000 }, fames: [], next: 48_000 },
    {
      name: '0까지 받은 구간',
      window: { minFame: 0, maxFame: 1_500 },
      fames: [700],
      next: undefined
    },
    {
      name: '꽉 찬 구간',
      window: { minFame: 48_000, maxFame: 50_000 },
      fames: fullAbove,
      next: 49_200
    },
    {
      name: '최대 명성 하나로 꽉 찬 구간',
      window: { minFame: 48_000, maxFame: 50_000 },
      fames: fullAtMax,
      next: 49_999
    },
    {
      name: '명성 0으로 꽉 찬 구간',
      window: { minFame: 0, maxFame: 0 },
      fames: fullAtZero,
      next: undefined
    }
  ]

  for (const { name, window, fames, next } of cases) {
    assert.equal(nextMaxFame(window, fames), next, name)
  }
})

test('새 캐릭터 찾기 job은 일정 없이 수동으로만 돈다', () => {
  const { service } = discovery([])

  const job = createCharacterDiscoveryJob(service)

  assert.equal(job.name, 'character-discovery')
  assert.equal(job.schedule, undefined)
})
