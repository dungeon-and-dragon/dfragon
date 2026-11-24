import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  CharacterSkillStyleInput,
  SkillStyleChainBackfillKey,
  SkillStyleHistorySource
} from '@dfragon/database'
import { parseCharacterSkillStyle } from '@dfragon/server-core/infrastructure/neople/index.js'
import type { SkillChainBackfillRepository } from '../src/application/ranking-stats/repository.js'
import { SkillChainBackfillService } from '../src/application/ranking-stats/skill-chain-backfill.js'

// 합성 캐릭터다. DB는 스킬 스타일 행과 캐릭터별 가장 새 이력 원문을 메모리에 두는 fake이고, 체인이 없는 행만 key 순으로 읽는다.
const JOB = { jobId: 'synthetic-job', jobGrowId: 'synthetic-grow' }
const STORED_AT = new Date('2026-11-20T00:00:00Z')
const OBSERVED_AT = new Date('2026-11-18T00:00:00Z')

const storedStyle = (
  characterId: string,
  chain: CharacterSkillStyleInput['chain'] = null
): CharacterSkillStyleInput => ({
  serverId: 'cain',
  characterId,
  ...JOB,
  skills: [{ name: '저장된 스킬', level: 1 }],
  evolutions: [],
  enhancements: [],
  chain,
  fetchedAt: STORED_AT
})

const historyBody = (chain: unknown) => ({
  skill: {
    hash: 'synthetic-hash',
    style: {
      active: [
        { skillId: 'active-a', name: '원문 액티브', level: 13, requiredLevel: 1 },
        { skillId: 'active-b', name: '원문 개화', level: 1, requiredLevel: 100 }
      ],
      passive: [{ skillId: 'passive-a', name: '원문 패시브', level: 20, requiredLevel: 1 }],
      evolution: [{ skillId: 'active-b', type: 2 }],
      enhancement: [{ skillId: 'active-a', type: 1 }],
      chain
    }
  }
})

const source = (chain: unknown, job = JOB): SkillStyleHistorySource => ({
  observedAt: OBSERVED_AT,
  ...job,
  body: historyBody(chain)
})

const keyOf = ({ serverId, characterId }: SkillStyleChainBackfillKey) =>
  JSON.stringify([serverId, characterId])

function fakeDatabase(
  styles: CharacterSkillStyleInput[],
  sources: ReadonlyMap<string, SkillStyleHistorySource>
) {
  const table = new Map(styles.map((style) => [keyOf(style), style]))
  let changeBeforeFill: ((key: string) => void) | undefined

  const repository: SkillChainBackfillRepository = {
    readPage: async ({ after, limit }) =>
      [...table.values()]
        .filter((style) => style.chain === null)
        .filter((style) => after === null || keyOf(style) > keyOf(after))
        .sort((left, right) => (keyOf(left) < keyOf(right) ? -1 : 1))
        .slice(0, limit)
        .map(({ serverId, characterId, jobId, jobGrowId }) => ({
          serverId,
          characterId,
          jobId,
          jobGrowId,
          source: sources.get(characterId) ?? null
        })),
    fillChain: async (style) => {
      const key = keyOf(style)
      changeBeforeFill?.(key)
      const stored = table.get(key)
      if (
        stored === undefined ||
        stored.chain !== null ||
        stored.jobId !== style.jobId ||
        stored.jobGrowId !== style.jobGrowId
      ) {
        return false
      }

      table.set(key, style)

      return true
    }
  }

  return {
    repository,
    table,
    onFill: (change: (key: string) => void) => {
      changeBeforeFill = change
    }
  }
}

const backfill = (repository: SkillChainBackfillRepository) =>
  new SkillChainBackfillService(repository, parseCharacterSkillStyle).backfill(() => {})

test('이력 원문의 전직이 같으면 스킬, 개화, 강화, 체인을 모두 원문 값과 받은 시각으로 다시 쓴다', async () => {
  const { repository, table } = fakeDatabase(
    [storedStyle('a')],
    new Map([['a', source({ resetTime: 0, skills: ['active-b', null, 'active-a', 'passive-a'] })]])
  )

  const summary = await backfill(repository)

  assert.deepEqual(table.get(keyOf(storedStyle('a'))), {
    serverId: 'cain',
    characterId: 'a',
    ...JOB,
    skills: [
      { name: '원문 액티브', level: 13 },
      { name: '원문 개화', level: 1 },
      { name: '원문 패시브', level: 20 }
    ],
    evolutions: [{ name: '원문 개화', type: 2 }],
    enhancements: [{ name: '원문 액티브', type: 1 }],
    chain: ['원문 개화', null, '원문 액티브', '원문 패시브'],
    fetchedAt: OBSERVED_AT
  })
  assert.equal(summary.filled, 1)
})

test('원문이 없거나, 원문의 전직이 다르거나, 원문 체인을 모르는 행은 그대로 둔다', async () => {
  const styles = [
    storedStyle('no-history'),
    storedStyle('job-changed'),
    storedStyle('no-chain'),
    storedStyle('unknown-skill')
  ]
  const { repository, table } = fakeDatabase(
    styles,
    new Map([
      ['job-changed', source({ skills: ['active-a'] }, { ...JOB, jobGrowId: 'other-grow' })],
      ['no-chain', source(null)],
      ['unknown-skill', source({ skills: ['active-a', 'removed-skill'] })]
    ])
  )

  const summary = await backfill(repository)

  assert.deepEqual([...table.values()], styles)
  assert.deepEqual(summary, {
    characters: 4,
    filled: 0,
    noHistory: 1,
    jobChanged: 1,
    noChain: 2,
    changed: 0
  })
})

test('두 번 돌려도 결과가 같고, 두 번째는 남은 행만 다시 본다', async () => {
  const { repository, table } = fakeDatabase(
    [storedStyle('a'), storedStyle('b'), storedStyle('c')],
    new Map([
      ['a', source({ skills: ['active-a', null, null, null] })],
      ['c', source({ skills: [null, null, null, 'passive-a'] })]
    ])
  )

  const first = await backfill(repository)
  const afterFirst = structuredClone([...table.values()])
  const second = await backfill(repository)

  assert.deepEqual([...table.values()], afterFirst)
  assert.equal(first.filled, 2)
  assert.deepEqual(second, {
    characters: 1,
    filled: 0,
    noHistory: 1,
    jobChanged: 0,
    noChain: 0,
    changed: 0
  })
})

test('읽은 뒤 상세 조회가 체인을 저장해 쓰지 못한 행은 changed로 센다', async () => {
  const { repository, table, onFill } = fakeDatabase(
    [storedStyle('a')],
    new Map([['a', source({ skills: ['active-a', null, null, null] })]])
  )
  const fresh = { ...storedStyle('a', ['새 스킬', null, null, null]), fetchedAt: new Date() }
  onFill((key) => table.set(key, fresh))

  const summary = await backfill(repository)

  assert.deepEqual(table.get(keyOf(fresh)), fresh)
  assert.equal(summary.changed, 1)
})
