import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  CharacterBasicInput,
  CharacterSkillStyleInput,
  CollectedCharacter,
  SkillStyleSampleJob
} from '@dfragon/database'
import { NeopleRequestFailure } from '@dfragon/neople'
import {
  type FetchSkillStyle,
  type SkillStyleStore
} from '../src/skill-style-collection/collect.js'
import { readSkillStyleCollectorConfiguration } from '../src/skill-style-collection/configuration.js'
import {
  type SkillStylePassDependencies,
  runSkillStylePass
} from '../src/skill-style-collection/runner.js'

const job: SkillStyleSampleJob = { jobId: 'job', jobGrowId: 'grow' }

// 합성 캐릭터다.
function basicOf({ serverId, characterId }: CollectedCharacter): CharacterBasicInput {
  return {
    serverId,
    characterId,
    characterName: `이름-${characterId}`,
    adventureName: '모험단',
    level: 115,
    jobId: job.jobId,
    jobGrowId: job.jobGrowId,
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    fame: 60000,
    guildId: null,
    guildName: null
  }
}

const skillStyle = {
  jobId: job.jobId,
  jobGrowId: job.jobGrowId,
  skills: [{ name: '합성스킬', level: 13 }],
  evolutions: [{ name: '합성스킬', type: 1 }],
  enhancements: []
}

const fetchAll: FetchSkillStyle = async (character) => ({ basic: basicOf(character), skillStyle })

// 갱신 대상 query처럼 저장한 캐릭터와 이번 회차에 뺀 캐릭터를 다시 고르지 않는 fake이며 DB를 쓰지 않는다.
function memoryStore(sample: CollectedCharacter[]) {
  const recorded: Array<[CharacterBasicInput, CharacterSkillStyleInput]> = []
  const deleted: string[] = []
  const store: SkillStyleStore = {
    readJobs: async () => [job],
    takeBatch: async (_job, skipped, limit) =>
      sample
        .filter(
          ({ characterId }) =>
            !recorded.some(([basic]) => basic.characterId === characterId) &&
            !skipped.some((character) => character.characterId === characterId)
        )
        .slice(0, limit),
    record: async (basic, style) => {
      recorded.push([basic, style])
    },
    deleteSkillStyle: async ({ characterId }) => {
      deleted.push(characterId)
    }
  }

  return { store, recorded, deleted }
}

const characters = ['c0', 'c1', 'c2'].map((characterId) => ({ serverId: 'cain', characterId }))

function passOf(
  store: SkillStyleStore,
  fetchSkillStyle: FetchSkillStyle,
  reports: string[] = []
): SkillStylePassDependencies {
  return {
    fetchSkillStyle,
    store,
    requestIntervalMs: 0,
    concurrency: 1,
    report: (code) => reports.push(code)
  }
}

test('받은 기본 정보와 스킬 스타일을 받은 시각과 함께 저장 함수 하나에 넘긴다', async () => {
  const memory = memoryStore([characters[0]])
  const before = new Date()

  assert.equal(await runSkillStylePass(passOf(memory.store, fetchAll)), 'drained')

  assert.equal(memory.recorded.length, 1)
  const [basic, style] = memory.recorded[0]
  assert.deepEqual(basic, basicOf(characters[0]))
  assert.deepEqual(
    { ...style, fetchedAt: undefined },
    { serverId: 'cain', characterId: 'c0', ...skillStyle, fetchedAt: undefined }
  )
  assert.ok(style.fetchedAt >= before && style.fetchedAt <= new Date())
})

test('한도 초과, 점검, timeout이면 저장도 삭제도 하지 않고 회차를 멈추며, 다음 회차에 같은 캐릭터부터 다시 부른다', async () => {
  for (const kind of ['unavailable', 'timeout'] as const) {
    const memory = memoryStore(characters)
    const reports: string[] = []
    const called: string[] = []
    const fetchSkillStyle: FetchSkillStyle = async (character) => {
      called.push(character.characterId)
      if (character.characterId === 'c1' && called.length === 2) {
        throw new NeopleRequestFailure(kind)
      }

      return fetchAll(character)
    }

    const stopped = await runSkillStylePass(passOf(memory.store, fetchSkillStyle, reports))
    assert.equal(stopped, 'unavailable', kind)
    assert.deepEqual(called, ['c0', 'c1'], kind)
    assert.deepEqual(memory.deleted, [], kind)
    assert.deepEqual(reports, ['SKILL_STYLE_NEOPLE_UNAVAILABLE'], kind)

    assert.equal(await runSkillStylePass(passOf(memory.store, fetchSkillStyle)), 'drained', kind)
    assert.deepEqual(called, ['c0', 'c1', 'c1', 'c2'], kind)
    assert.deepEqual(
      memory.recorded.map(([basic]) => basic.characterId),
      ['c0', 'c1', 'c2'],
      kind
    )
  }
})

test('없는 캐릭터는 스킬 스타일 행을 지우고, 그 밖의 실패는 기록만 남기며, 둘 다 이번 회차에서 다시 부르지 않는다', async () => {
  const memory = memoryStore(characters)
  const reports: string[] = []
  const called: string[] = []
  const fetchSkillStyle: FetchSkillStyle = async (character) => {
    called.push(character.characterId)
    if (character.characterId === 'c0') {
      throw new NeopleRequestFailure('api', { characterNotFound: true })
    }

    if (character.characterId === 'c1') {
      throw new NeopleRequestFailure('internal')
    }

    return fetchAll(character)
  }

  assert.equal(await runSkillStylePass(passOf(memory.store, fetchSkillStyle, reports)), 'drained')

  assert.deepEqual(called, ['c0', 'c1', 'c2'])
  assert.deepEqual(memory.deleted, ['c0'])
  assert.deepEqual(
    memory.recorded.map(([basic]) => basic.characterId),
    ['c2']
  )
  assert.deepEqual(reports, ['SKILL_STYLE_NEOPLE_FAILED', 'SKILL_STYLE_NEOPLE_FAILED'])
})

test('Neople 밖의 오류는 기록하지 않고 그대로 던진다', async () => {
  const memory = memoryStore([characters[0]])
  const databaseError = new Error('database down')

  await assert.rejects(
    runSkillStylePass(
      passOf(memory.store, async () => {
        throw databaseError
      })
    ),
    databaseError
  )
  assert.deepEqual(memory.deleted, [])
})

// 합성 key와 DB 입력이다. 실제 credential이 아니다.
const collectorEnvironment = {
  NEOPLE_API_KEY: 'synthetic-neople-key',
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_NAME: 'dfragon',
  DB_USERNAME: 'dfragon_api',
  DB_PASSWORD: 'synthetic'
}

test('스킬 스타일 worker 설정은 요청 상한 기본값이 5, 동시 처리 기본값이 1이며, 잘못된 입력은 값 없이 거절한다', () => {
  const configuration = readSkillStyleCollectorConfiguration(collectorEnvironment)
  assert.equal(configuration.requestsPerSecond, 5)
  assert.equal(configuration.concurrency, 1)
  const tuned = readSkillStyleCollectorConfiguration({
    ...collectorEnvironment,
    SKILL_STYLE_COLLECTOR_REQUESTS_PER_SECOND: '2.5',
    SKILL_STYLE_COLLECTOR_CONCURRENCY: '4'
  })
  assert.deepEqual([tuned.requestsPerSecond, tuned.concurrency], [2.5, 4])
  const { DB_HOST: _, ...withoutDatabase } = collectorEnvironment
  const { NEOPLE_API_KEY: __, ...withoutKey } = collectorEnvironment
  for (const invalid of [
    withoutDatabase,
    withoutKey,
    { ...collectorEnvironment, SKILL_STYLE_COLLECTOR_REQUESTS_PER_SECOND: '0' },
    { ...collectorEnvironment, SKILL_STYLE_COLLECTOR_CONCURRENCY: '33' }
  ]) {
    assert.throws(() => readSkillStyleCollectorConfiguration(invalid), {
      message: 'Invalid skill style collector configuration'
    })
  }
})
