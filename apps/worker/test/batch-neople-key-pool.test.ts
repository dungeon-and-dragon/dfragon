import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type { UsableBatchNeopleKey } from '@dfragon/database'
import { type NeopleCharacterBasic, NeopleRequestFailure } from '@dfragon/neople'
import {
  type BatchNeopleKeyRepository,
  createBatchNeopleKeyPool
} from '../src/infrastructure/neople/batch-key-pool.js'
import type { WorkerNeople } from '../src/infrastructure/neople/character-collection.js'

const identity = { serverId: 'cain', characterId: 'synthetic-character' }

// 합성 key다. 실제 credential이 아니다.
const syntheticKey = (id: number): UsableBatchNeopleKey => ({ id, key: `synthetic-key-${id}` })

const basic: NeopleCharacterBasic = {
  serverId: 'cain',
  characterId: 'synthetic-character',
  characterName: '합성',
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

const upstreamFailure = (status: number, code: string) =>
  new NeopleRequestFailure('unavailable', { upstream: { status, code } })

// 기본 정보 요청만 받는 key별 가짜 client다. answer가 key마다 응답이나 실패를 정한다.
function fakeKeys(
  ids: number[],
  answer: (key: string) => Promise<NeopleCharacterBasic> = async () => basic,
  concurrencyPerKey = 1
) {
  const keys = ids.map(syntheticKey)
  const requests: string[] = []
  const rejected: number[] = []
  const reports: [string, Readonly<Record<string, string | number>>][] = []
  const store: BatchNeopleKeyRepository = {
    readUsableKeys: async () => keys.filter(({ id }) => !rejected.includes(id)),
    recordRejected: async (id) => {
      rejected.push(id)
    }
  }
  const createNeople = (key: string): WorkerNeople => ({
    character: async () => {
      throw new Error('이 테스트는 상세 섹션을 부르지 않는다')
    },
    multiItems: async () => {
      throw new Error('이 테스트는 아이템 상세를 부르지 않는다')
    },
    characterBasic: async () => {
      requests.push(key)

      return answer(key)
    },
    characterSkillStyle: async () => {
      throw new Error('이 테스트는 스킬 스타일을 부르지 않는다')
    },
    characterTimeline: async () => {
      throw new Error('이 테스트는 타임라인을 부르지 않는다')
    }
  })
  const pool = createBatchNeopleKeyPool({
    store,
    createNeople,
    concurrencyPerKey,
    report: (code, details) => {
      reports.push([code, details])
    }
  })

  return { keys, pool, requests, rejected, reports }
}

test('켜진 key가 없으면 Neople을 부르지 않고 no-key인 unavailable로 실패하며 묶음 크기는 1이다', async () => {
  const { pool, requests } = fakeKeys([])
  await pool.refresh()

  await assert.rejects(pool.neople.characterBasic(identity), (error) => {
    assert(error instanceof NeopleRequestFailure)
    assert.equal(error.kind, 'unavailable')
    assert.equal(error.keyShortage, 'no-key')

    return true
  })
  assert.deepEqual(requests, [])
  assert.equal(pool.readConcurrency(), 1)
})

test('key의 동시 요청 수가 차 있으면 실패하지 않고 앞 요청이 끝난 뒤 보낸다', async () => {
  const pending: (() => void)[] = []
  const { pool, requests } = fakeKeys(
    [1],
    () =>
      new Promise((resolve) => {
        pending.push(() => {
          resolve(basic)
        })
      })
  )
  await pool.refresh()

  const first = pool.neople.characterBasic(identity)
  const second = pool.neople.characterBasic(identity)
  await setImmediate()
  assert.equal(requests.length, 1)

  pending[0]?.()
  await first
  await setImmediate()
  assert.equal(requests.length, 2)

  pending[1]?.()
  assert.deepEqual(await second, basic)
})

for (const code of ['API000', 'API003', 'API004', 'API005']) {
  test(`Neople이 ${code}로 key를 거절하면 그 key의 거절을 한 번 기록하고 같은 요청을 다른 key로 보낸다`, async () => {
    const { keys, pool, requests, rejected, reports } = fakeKeys(
      [1, 2],
      async (key) => {
        await setImmediate()

        if (key === keys[0]?.key) {
          throw new NeopleRequestFailure('internal', { upstream: { status: 401, code } })
        }

        return basic
      },
      2
    )
    await pool.refresh()

    const concurrent = Array.from({ length: 4 }, () => pool.neople.characterBasic(identity))

    assert.deepEqual(await Promise.all(concurrent), [basic, basic, basic, basic])
    assert.deepEqual(rejected, [1])
    assert.equal(pool.readConcurrency(), 2)
    assert.deepEqual(reports, [['BATCH_NEOPLE_KEY_REJECTED', { keyId: 1, code }]])

    const requestsAfterRejection = requests.length
    await pool.neople.characterBasic(identity)
    assert.deepEqual(requests.slice(requestsAfterRejection), ['synthetic-key-2'])
  })
}

const keyIndependentFailures = [
  { name: 'DNF980 점검', failure: () => upstreamFailure(503, 'DNF980') },
  { name: 'API008 IP 사용량 초과', failure: () => upstreamFailure(400, 'API008') },
  { name: 'timeout', failure: () => new NeopleRequestFailure('timeout') }
]

for (const { name, failure } of keyIndependentFailures) {
  test(`${name}는 key를 쉬게 하지 않고 그대로 실패시킨다`, async () => {
    const thrown = failure()
    let attempts = 0
    const { pool, requests, rejected, reports } = fakeKeys([1], async () => {
      attempts++
      if (attempts === 1) {
        throw thrown
      }

      return basic
    })
    await pool.refresh()

    await assert.rejects(pool.neople.characterBasic(identity), (error) => error === thrown)
    assert.deepEqual(await pool.neople.characterBasic(identity), basic)
    assert.deepEqual(requests, ['synthetic-key-1', 'synthetic-key-1'])
    assert.deepEqual(rejected, [])
    assert.deepEqual(reports, [])
  })
}

test('API002를 받은 key는 60초 동안 새 요청을 받지 않고, 모든 key가 쉬면 all-resting인 unavailable로 실패한다', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 })
  let limited = true
  const { pool, requests, reports } = fakeKeys([1], async () => {
    if (limited) {
      throw upstreamFailure(400, 'API002')
    }

    return basic
  })
  await pool.refresh()

  await assert.rejects(pool.neople.characterBasic(identity), (error) => {
    assert(error instanceof NeopleRequestFailure)
    assert.equal(error.kind, 'unavailable')
    assert.equal(error.keyShortage, 'all-resting')

    return true
  })
  limited = false
  t.mock.timers.tick(30_000)
  await assert.rejects(pool.neople.characterBasic(identity), { keyShortage: 'all-resting' })

  t.mock.timers.tick(31_000)
  assert.deepEqual(await pool.neople.characterBasic(identity), basic)
  assert.deepEqual(requests, ['synthetic-key-1', 'synthetic-key-1'])
  assert.deepEqual(reports, [['BATCH_NEOPLE_KEY_RESTING', { keyId: 1 }]])
})
