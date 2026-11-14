import assert from 'node:assert/strict'
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { ZodError } from 'zod'
import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'
import { NeopleRequestFailure } from '@dfragon/neople'
import { CharacterCollectionFailure } from '../src/domain/character-collection/failure.js'
import { collectCharacter } from '../src/application/character-collection/collect.js'
import { createNeopleCharacterBasic } from '../src/infrastructure/neople/character-collection.js'
import { readCollectorConfiguration } from '../src/runtime/collector-configuration.js'
import {
  importCollectedCharacters,
  readImportModifiedTime
} from '../src/infrastructure/files/character-collection.js'
import type {
  CharacterCollectionPorts,
  FetchCharacterBasic
} from '../src/application/character-collection/ports.js'
import type {
  CollectionFailure,
  CollectionRepository
} from '../src/application/character-collection/repository.js'
import { CharacterCollectionService } from '../src/application/character-collection/service.js'

type CollectionStore = Omit<CollectionRepository, 'enqueue'>

type CollectionPassDependencies = Omit<CharacterCollectionPorts, 'pause'> & {
  store: CollectionStore
  enqueue: CollectionRepository['enqueue']
  importedAt: ReadonlyMap<string, number>
}

function runCollectionPass({ store, enqueue, importedAt, ...ports }: CollectionPassDependencies) {
  const pause = async () => {}

  return new CharacterCollectionService({ ...store, enqueue }, { ...ports, pause }).runPass(
    importedAt
  )
}

// 합성 캐릭터다.
function basicOf({ serverId, characterId }: CollectedCharacter): CharacterBasicInput {
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
    fame: 60000,
    guildId: null,
    guildName: null
  }
}

// 저장 함수와 같은 상태 전이(성공하면 대기열에서 빠지고, 실패한 캐릭터는 다시 꺼내지 않음)를 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryStore(queued: CollectedCharacter[]) {
  const queue = [...queued]
  const recorded: CharacterBasicInput[] = []
  const failures: Array<[string, CollectionFailure]> = []
  const store: CollectionStore = {
    takeBatch: async (limit) => {
      const batch = queue
        .filter((character) => !failures.some(([id]) => id === character.characterId))
        .slice(0, limit)

      return batch
    },
    recordBasic: async (basic) => {
      recorded.push(basic)
      queue.splice(
        queue.findIndex((character) => character.characterId === basic.characterId),
        1
      )
    },
    recordFailure: async (character, failure) => {
      failures.push([character.characterId, failure])
    }
  }

  return { store, queue, recorded, failures }
}

const first = { serverId: 'cain', characterId: 'first' }

for (const [kind, outcome, failures] of [
  ['api', 'failed', [['first', 'neople-api']]],
  ['unavailable', 'unavailable', []],
  ['timeout', 'unavailable', []],
  ['internal', 'failed', [['first', 'neople-internal']]]
] as const) {
  test(`Neople ${kind} 실패는 같은 kind로 변환되고 수집에서 ${outcome}으로 처리된다`, async () => {
    const fetchBasic = createNeopleCharacterBasic({
      characterBasic: async () => {
        throw new NeopleRequestFailure(kind)
      }
    })
    await assert.rejects(fetchBasic(first), (error: unknown) => {
      assert.ok(error instanceof CharacterCollectionFailure)
      assert.equal(error.kind, kind)

      return true
    })
    const memory = memoryStore([first])

    assert.equal(await collectCharacter(first, fetchBasic, memory.store), outcome)
    assert.deepEqual(memory.failures, failures)
    assert.deepEqual(memory.recorded, [])
  })
}

test('Neople 실패가 아닌 오류는 adapter와 수집 흐름에서 같은 오류로 다시 던지고 기록하지 않는다', async () => {
  const original = new TypeError('synthetic Neople client bug')
  const fetchBasic = createNeopleCharacterBasic({
    characterBasic: async () => {
      throw original
    }
  })
  const memory = memoryStore([first])

  await assert.rejects(fetchBasic(first), (error: unknown) => error === original)
  await assert.rejects(
    collectCharacter(first, fetchBasic, memory.store),
    (error: unknown) => error === original
  )
  assert.deepEqual(memory.failures, [])
  assert.deepEqual(memory.recorded, [])
})

test('기본 정보를 받으면 저장하고, 없는 캐릭터 같은 api 실패는 실패로 기록한다', async () => {
  const saved = memoryStore([first])
  assert.equal(await collectCharacter(first, async (c) => basicOf(c), saved.store), 'recorded')
  assert.deepEqual(saved.recorded, [basicOf(first)])

  const failed = memoryStore([first])
  const notFound: FetchCharacterBasic = async () => {
    throw new CharacterCollectionFailure('api')
  }
  assert.equal(await collectCharacter(first, notFound, failed.store), 'failed')
  assert.deepEqual(failed.failures, [['first', 'neople-api']])
  assert.deepEqual(failed.recorded, [])
})

test('한도 초과, 점검, timeout은 기록하지 않고 unavailable을 돌려준다', async () => {
  for (const kind of ['unavailable', 'timeout'] as const) {
    const { store, failures, recorded } = memoryStore([first])
    const result = await collectCharacter(
      first,
      async () => {
        throw new CharacterCollectionFailure(kind)
      },
      store
    )
    assert.equal(result, 'unavailable', kind)
    assert.deepEqual(failures, [], kind)
    assert.deepEqual(recorded, [], kind)
  }
})

test('Neople 밖의 오류는 기록하지 않고 그대로 던진다', async () => {
  const { store, failures } = memoryStore([first])
  const databaseError = new Error('database down')

  await assert.rejects(
    collectCharacter(
      first,
      async () => {
        throw databaseError
      },
      store
    ),
    databaseError
  )
  assert.deepEqual(failures, [])
})

test('목록 JSONL의 server, key를 1000개 단위로 넘기고 빈 줄은 건너뛴다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'character-import-'))
  try {
    const path = join(directory, 'characters.jsonl')
    const lines = Array.from({ length: 1001 }, (_, index) =>
      JSON.stringify({ server: 'cain', key: `id-${index}`, nick: `이름${index}`, rank: index + 1 })
    )
    await writeFile(path, `${lines.join('\n')}\n\n`)
    const batches: CollectedCharacter[][] = []

    const count = await importCollectedCharacters(path, async (batch) => {
      batches.push([...batch])
    })

    assert.equal(count, 1001)
    assert.deepEqual(
      batches.map((batch) => batch.length),
      [1000, 1]
    )
    assert.deepEqual(batches[1], [{ serverId: 'cain', characterId: 'id-1000' }])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('server나 key가 빠진 줄이 있으면 import가 실패한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'character-import-'))
  try {
    const path = join(directory, 'characters.jsonl')
    await writeFile(path, `${JSON.stringify({ server: 'cain', key: null })}\n`)

    await assert.rejects(
      importCollectedCharacters(path, async () => {}),
      ZodError
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('목록 파일 여러 개를 대기열에 넣고 대기열이 빌 때까지 기본 정보를 저장하며, 바뀐 파일만 다시 넣는다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'character-collector-'))
  try {
    const listFile = (shard: number) => join(directory, `characters-${shard}.jsonl`)
    const writeList = (shard: number, keys: string[]) =>
      writeFile(
        listFile(shard),
        keys.map((key) => JSON.stringify({ server: 'cain', key })).join('\n')
      )
    await writeList(1, ['first'])
    await writeList(2, ['second'])
    const memory = memoryStore([])
    const reports: Array<[string, number | undefined]> = []
    const dependencies: Omit<CollectionPassDependencies, 'importedAt'> = {
      readModifiedTime: readImportModifiedTime,
      importCharacters: importCollectedCharacters,
      importFiles: [listFile(1), listFile(2)],
      enqueue: async (characters) => {
        memory.queue.push(...characters)
      },
      fetchBasic: async (character) => basicOf(character),
      store: memory.store,
      readConcurrency: () => 1,
      report: (code, details) => reports.push([code, details?.count])
    }

    const initialPass = await runCollectionPass({ ...dependencies, importedAt: new Map() })
    const unchangedPass = await runCollectionPass({
      ...dependencies,
      importedAt: initialPass.importedAt
    })
    await writeList(2, ['second', 'third'])
    // 같은 ms 안에 다시 쓰면 수정 시각이 같을 수 있어 바뀐 파일의 수정 시각을 확실히 뒤로 둔다.
    await utimes(listFile(2), new Date(), new Date(Date.now() + 60_000))
    const changedPass = await runCollectionPass({
      ...dependencies,
      importedAt: unchangedPass.importedAt
    })

    assert.deepEqual(
      [initialPass.outcome, unchangedPass.outcome, changedPass.outcome],
      ['drained', 'drained', 'drained']
    )
    assert.deepEqual(
      memory.recorded.map((basic) => basic.characterId),
      ['first', 'second', 'second', 'third']
    )
    assert.deepEqual(reports, [
      ['CHARACTER_IMPORT_DONE', 1],
      ['CHARACTER_IMPORT_DONE', 1],
      ['CHARACTER_IMPORT_DONE', 2]
    ])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('Neople을 쓸 수 없으면 실패로 기록하지 않고 멈추며, 다음 회차에 같은 캐릭터를 다시 부른다', async () => {
  const memory = memoryStore([first])
  const reports: string[] = []
  let calls = 0
  const dependencies: CollectionPassDependencies = {
    readModifiedTime: readImportModifiedTime,
    importCharacters: importCollectedCharacters,
    importFiles: [join(tmpdir(), 'missing-character-list.jsonl')],
    importedAt: new Map(),
    enqueue: async () => {},
    fetchBasic: async (character) => {
      calls++
      if (calls === 1) {
        throw new CharacterCollectionFailure('unavailable')
      }

      return basicOf(character)
    },
    store: memory.store,
    readConcurrency: () => 1,
    report: (code) => reports.push(code)
  }

  const stopped = await runCollectionPass(dependencies)
  assert.equal(stopped.outcome, 'unavailable')
  assert.deepEqual(
    memory.recorded.map((basic) => basic.characterId),
    []
  )
  assert.deepEqual(memory.failures, [])

  const resumed = await runCollectionPass(dependencies)
  assert.equal(resumed.outcome, 'drained')
  assert.deepEqual(
    memory.recorded.map((basic) => basic.characterId),
    ['first']
  )
  assert.deepEqual(reports, ['CHARACTER_NEOPLE_UNAVAILABLE'])
})

test('동시 처리 수만큼 기본 정보를 함께 받고 그 수를 넘지 않으며 모두 저장한다', async () => {
  const queued = Array.from({ length: 7 }, (_, index) => ({
    serverId: 'cain',
    characterId: `c${index}`
  }))
  const memory = memoryStore(queued)
  let inFlight = 0
  let maxInFlight = 0

  const result = await runCollectionPass({
    readModifiedTime: readImportModifiedTime,
    importCharacters: importCollectedCharacters,
    importFiles: [],
    importedAt: new Map(),
    enqueue: async () => {},
    fetchBasic: async (character) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await setImmediate()
      inFlight--

      return basicOf(character)
    },
    store: memory.store,
    readConcurrency: () => 3,
    report: () => {}
  })

  assert.equal(result.outcome, 'drained')
  assert.equal(maxInFlight, 3)
  assert.deepEqual(
    memory.recorded.map((basic) => basic.characterId).sort(),
    queued.map((character) => character.characterId)
  )
})

test('동시 처리 수를 묶음마다 다시 읽어 바뀐 수만큼 함께 받는다', async () => {
  const queued = Array.from({ length: 6 }, (_, index) => ({
    serverId: 'cain',
    characterId: `c${index}`
  }))
  const memory = memoryStore(queued)
  const concurrencies = [1, 3, 2]
  const groups: string[][] = []
  let group: string[] = []

  await runCollectionPass({
    readModifiedTime: readImportModifiedTime,
    importCharacters: importCollectedCharacters,
    importFiles: [],
    importedAt: new Map(),
    enqueue: async () => {},
    fetchBasic: async (character) => {
      group.push(character.characterId)
      await setImmediate()

      return basicOf(character)
    },
    store: memory.store,
    readConcurrency: () => {
      if (group.length > 0) {
        groups.push(group)
        group = []
      }

      const concurrency = concurrencies[groups.length]
      if (concurrency === undefined) {
        throw new Error('6명을 세 묶음으로 받는다')
      }

      return concurrency
    },
    report: () => {}
  })
  groups.push(group)

  assert.deepEqual(groups, [['c0'], ['c1', 'c2', 'c3'], ['c4', 'c5']])
})

test('묶음 안에서 한 명만 Neople을 쓸 수 없으면 나머지는 저장하고 그 캐릭터만 다음 회차에 다시 부른다', async () => {
  const queued = ['c0', 'c1', 'c2'].map((characterId) => ({ serverId: 'cain', characterId }))
  const memory = memoryStore(queued)
  const called: string[] = []
  const dependencies: CollectionPassDependencies = {
    readModifiedTime: readImportModifiedTime,
    importCharacters: importCollectedCharacters,
    importFiles: [],
    importedAt: new Map(),
    enqueue: async () => {},
    fetchBasic: async (character) => {
      called.push(character.characterId)
      if (character.characterId === 'c1' && called.length <= 2) {
        throw new CharacterCollectionFailure('unavailable')
      }

      return basicOf(character)
    },
    store: memory.store,
    readConcurrency: () => 2,
    report: () => {}
  }

  const stopped = await runCollectionPass(dependencies)
  assert.equal(stopped.outcome, 'unavailable')
  assert.deepEqual(
    memory.recorded.map((basic) => basic.characterId),
    ['c0']
  )
  assert.deepEqual(memory.failures, [])

  const resumed = await runCollectionPass(dependencies)
  assert.equal(resumed.outcome, 'drained')
  assert.deepEqual(called, ['c0', 'c1', 'c1', 'c2'])
  assert.deepEqual(
    memory.recorded.map((basic) => basic.characterId),
    ['c0', 'c1', 'c2']
  )
})

// 합성 DB 입력이다. 실제 credential이 아니다.
const collectorEnvironment = {
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_NAME: 'dfragon',
  DB_USERNAME: 'dfragon_api',
  DB_PASSWORD: 'synthetic',
  CHARACTER_IMPORT_FILES: '/data/1/characters.jsonl,/data/2/characters.jsonl'
}

test('수집 worker 설정은 Neople key 없이 읽히고, 목록 파일을 쉼표로 나눠 받으며 key당 요청 상한 기본값이 5, 동시 처리 기본값이 1이고, 잘못된 입력은 값 없이 거절한다', () => {
  const configuration = readCollectorConfiguration(collectorEnvironment)
  assert.deepEqual(configuration.importFiles, [
    '/data/1/characters.jsonl',
    '/data/2/characters.jsonl'
  ])
  assert.equal(configuration.requestsPerSecond, 5)
  assert.equal(configuration.concurrency, 1)
  assert.equal(
    readCollectorConfiguration({ ...collectorEnvironment, CHARACTER_COLLECTOR_CONCURRENCY: '8' })
      .concurrency,
    8
  )
  assert.equal(
    readCollectorConfiguration({ ...collectorEnvironment, CHARACTER_COLLECTOR_CONCURRENCY: '1024' })
      .concurrency,
    1024
  )
  assert.equal(
    readCollectorConfiguration({
      ...collectorEnvironment,
      CHARACTER_COLLECTOR_REQUESTS_PER_SECOND: '0.5'
    }).requestsPerSecond,
    0.5
  )
  const { DB_HOST: _, ...withoutDatabase } = collectorEnvironment
  for (const invalid of [
    withoutDatabase,
    {
      ...collectorEnvironment,
      CHARACTER_IMPORT_FILES: '/data/1/characters.jsonl,characters.jsonl'
    },
    { ...collectorEnvironment, CHARACTER_IMPORT_FILES: '' },
    { ...collectorEnvironment, CHARACTER_COLLECTOR_REQUESTS_PER_SECOND: '0' },
    { ...collectorEnvironment, CHARACTER_COLLECTOR_REQUESTS_PER_SECOND: 'fast' },
    { ...collectorEnvironment, CHARACTER_COLLECTOR_CONCURRENCY: '0' },
    { ...collectorEnvironment, CHARACTER_COLLECTOR_CONCURRENCY: '1025' },
    { ...collectorEnvironment, CHARACTER_COLLECTOR_CONCURRENCY: '1.5' },
    { ...collectorEnvironment, JOB_ALERT_DISCORD_WEBHOOK_URL: 'http://discord.test/webhook' },
    { ...collectorEnvironment, JOB_ALERT_DISCORD_WEBHOOK_URL: '' }
  ]) {
    assert.throws(() => readCollectorConfiguration(invalid), {
      message: 'Invalid character collector configuration'
    })
  }
})

test('수집 worker 설정은 점수 엔진 경로와 점수 계산 일정이 없어도 읽히고, 있으면 절대 경로와 올바른 cron 식만 받는다', () => {
  const defaults = readCollectorConfiguration(collectorEnvironment)
  assert.equal(defaults.scoreLibraryPath, null)
  assert.equal(defaults.scoreCalculationSchedule, undefined)

  const configured = readCollectorConfiguration({
    ...collectorEnvironment,
    SCORE_LIBRARY_FILE: '/app/score/libdnfscore.so',
    SCORE_CALCULATION_SCHEDULE: '30 20 * * 3'
  })

  assert.equal(configured.scoreLibraryPath, '/app/score/libdnfscore.so')
  assert.equal(configured.scoreCalculationSchedule, '30 20 * * 3')

  for (const invalid of [
    { ...collectorEnvironment, SCORE_LIBRARY_FILE: 'libdnfscore.so' },
    { ...collectorEnvironment, SCORE_CALCULATION_SCHEDULE: 'wednesday night' },
    { ...collectorEnvironment, SCORE_CALCULATION_SCHEDULE: '' }
  ]) {
    assert.throws(() => readCollectorConfiguration(invalid), {
      message: 'Invalid character collector configuration'
    })
  }
})

test('수집 worker 설정은 job 알림 웹훅이 없으면 알림 없이, 있으면 https URL로 받는다', () => {
  assert.equal(readCollectorConfiguration(collectorEnvironment).jobAlertWebhookUrl, undefined)
  assert.equal(
    readCollectorConfiguration({
      ...collectorEnvironment,
      JOB_ALERT_DISCORD_WEBHOOK_URL: 'https://discord.test/api/webhooks/synthetic'
    }).jobAlertWebhookUrl,
    'https://discord.test/api/webhooks/synthetic'
  )
})
