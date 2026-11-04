import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ZodError } from 'zod'
import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'
import { NeopleRequestFailure } from '@dfragon/neople'
import {
  type CollectionFailure,
  type CollectionStore,
  type FetchCharacterBasic,
  collectCharacter
} from '../src/character-collection/collect.js'
import { readCollectorConfiguration } from '../src/character-collection/configuration.js'
import { importCollectedCharacters } from '../src/character-collection/import.js'
import { runCharacterCollector } from '../src/character-collection/runner.js'

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
function memoryStore(queued: CollectedCharacter[], onEmpty: () => void = () => {}) {
  const queue = [...queued]
  const recorded: CharacterBasicInput[] = []
  const failures: Array<[string, CollectionFailure]> = []
  const store: CollectionStore = {
    takeBatch: async (limit) => {
      const batch = queue
        .filter((character) => !failures.some(([id]) => id === character.characterId))
        .slice(0, limit)
      if (batch.length === 0) {
        onEmpty()
      }

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

const zeroTiming = { requestIntervalMs: 0, idleMs: 0, unavailablePauseMs: 0 }
const first = { serverId: 'cain', characterId: 'first' }

test('기본 정보를 받으면 저장하고, 없는 캐릭터 같은 api 실패는 실패로 기록한다', async () => {
  const saved = memoryStore([first])
  assert.equal(await collectCharacter(first, async (c) => basicOf(c), saved.store), 'recorded')
  assert.deepEqual(saved.recorded, [basicOf(first)])

  const failed = memoryStore([first])
  const notFound: FetchCharacterBasic = async () => {
    throw new NeopleRequestFailure('api')
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
        throw new NeopleRequestFailure(kind)
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

test('목록 파일을 대기열에 넣고 대기열이 빌 때까지 기본 정보를 저장한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'character-collector-'))
  try {
    const importFile = join(directory, 'characters.jsonl')
    await writeFile(
      importFile,
      ['first', 'second'].map((key) => JSON.stringify({ server: 'cain', key })).join('\n')
    )
    const stop = new AbortController()
    const memory = memoryStore([], () => stop.abort())
    const reports: string[] = []

    await runCharacterCollector({
      importFile,
      enqueue: async (characters) => {
        memory.queue.push(...characters)
      },
      fetchBasic: async (character) => basicOf(character),
      store: memory.store,
      timing: zeroTiming,
      report: (code) => reports.push(code),
      signal: stop.signal
    })

    assert.deepEqual(
      memory.recorded.map((basic) => basic.characterId),
      ['first', 'second']
    )
    assert.deepEqual(reports, ['CHARACTER_IMPORT_DONE'])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('Neople을 쓸 수 없으면 실패로 기록하지 않고 같은 캐릭터를 다시 부른다', async () => {
  const stop = new AbortController()
  const memory = memoryStore([first], () => stop.abort())
  const reports: string[] = []
  let calls = 0

  await runCharacterCollector({
    importFile: join(tmpdir(), 'missing-character-list.jsonl'),
    enqueue: async () => {},
    fetchBasic: async (character) => {
      calls++
      if (calls === 1) {
        throw new NeopleRequestFailure('unavailable')
      }

      return basicOf(character)
    },
    store: memory.store,
    timing: zeroTiming,
    report: (code) => reports.push(code),
    signal: stop.signal
  })

  assert.equal(calls, 2)
  assert.deepEqual(
    memory.recorded.map((basic) => basic.characterId),
    ['first']
  )
  assert.deepEqual(memory.failures, [])
  assert.deepEqual(reports, ['CHARACTER_NEOPLE_UNAVAILABLE'])
})

test('종료 signal을 받으면 진행 중인 캐릭터를 저장하고 남은 캐릭터는 부르지 않는다', async () => {
  const stop = new AbortController()
  const memory = memoryStore([first, { serverId: 'cain', characterId: 'second' }])
  const called: string[] = []

  await runCharacterCollector({
    importFile: join(tmpdir(), 'missing-character-list.jsonl'),
    enqueue: async () => {},
    fetchBasic: async (character) => {
      called.push(character.characterId)
      stop.abort()

      return basicOf(character)
    },
    store: memory.store,
    // 요청 간격 대기도 종료 signal로 깨어나야 테스트가 끝난다.
    timing: { ...zeroTiming, requestIntervalMs: 60_000 },
    report: () => {},
    signal: stop.signal
  })

  assert.deepEqual(called, ['first'])
  assert.deepEqual(
    memory.recorded.map((basic) => basic.characterId),
    ['first']
  )
})

// 합성 key와 DB 입력이다. 실제 credential이 아니다.
const collectorEnvironment = {
  NEOPLE_API_KEY: 'synthetic-neople-key',
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_NAME: 'dfragon',
  DB_USERNAME: 'dfragon_api',
  DB_PASSWORD: 'synthetic',
  CHARACTER_IMPORT_FILE: '/data/characters.jsonl'
}

test('수집 worker 설정은 요청 상한 기본값이 5이고, 잘못된 입력은 값 없이 거절한다', () => {
  assert.equal(readCollectorConfiguration(collectorEnvironment).requestsPerSecond, 5)
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
    { ...collectorEnvironment, CHARACTER_IMPORT_FILE: 'characters.jsonl' },
    { ...collectorEnvironment, CHARACTER_COLLECTOR_REQUESTS_PER_SECOND: '0' },
    { ...collectorEnvironment, CHARACTER_COLLECTOR_REQUESTS_PER_SECOND: 'fast' }
  ]) {
    assert.throws(() => readCollectorConfiguration(invalid), {
      message: 'Invalid character collector configuration'
    })
  }
})
