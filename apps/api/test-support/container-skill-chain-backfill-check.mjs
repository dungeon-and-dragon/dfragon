import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  fillCharacterSkillStyleChain,
  readDatabaseConfiguration,
  recordCharacterBasic,
  recordCharacterHistory,
  recordCharacterSkillStyle
} from '@dfragon/database'
import { parseCharacterSkillStyle } from '@dfragon/server-core/infrastructure/neople/index.js'
import { SkillChainBackfillService } from './dist/application/ranking-stats/skill-chain-backfill.js'
import { DatabaseSkillChainBackfillRepository } from './dist/infrastructure/database/skill-chain-backfill.js'

// 합성 캐릭터다. 앞 단계가 넣은 스킬 스타일 행도 있어 이 단계의 캐릭터 행만 비교한다.
const job = { jobId: 'synthetic-chain-job', jobGrowId: 'synthetic-chain-grow' }
const otherJob = { jobId: 'synthetic-chain-job', jobGrowId: 'synthetic-chain-other-grow' }
const storedAt = new Date('2026-11-20T00:00:00Z')
const observedAt = new Date('2026-11-18T00:00:00Z')
const basic = (characterId, { jobId, jobGrowId }) => ({
  characterName: `합성${characterId}`,
  adventureName: '합성체인모험단',
  level: 115,
  jobId,
  jobGrowId,
  jobName: '합성직업',
  jobGrowName: '합성전직',
  fame: 70000,
  guildId: null,
  guildName: null
})
const skillStyleBody = (chain) => ({
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
const storedStyle = (characterId, chain) => ({
  serverId: 'cain',
  characterId,
  ...job,
  skills: [{ name: '저장된 스킬', level: 1 }],
  evolutions: [],
  enhancements: [],
  chain,
  fetchedAt: storedAt
})

const characters = [
  {
    characterId: 'chain-same',
    history: { job, chain: { resetTime: 0, skills: ['active-b', null, 'active-a', null] } }
  },
  {
    characterId: 'chain-other-job',
    history: { job: otherJob, chain: { resetTime: 0, skills: ['active-a', null, null, null] } }
  },
  { characterId: 'chain-no-history', history: null },
  { characterId: 'chain-null', history: { job, chain: null } },
  {
    characterId: 'chain-kept',
    storedChain: ['저장된 스킬', null, null, null],
    history: { job, chain: { resetTime: 0, skills: ['active-a', null, null, null] } }
  }
]

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
const readRows = async () =>
  client.$queryRaw`
    SELECT "character_id" AS "characterId", "skills", "evolutions", "enhancements", "chain", "fetched_at" AS "fetchedAt"
    FROM "character_skill_styles"
    WHERE "server_id" = 'cain' AND "character_id" LIKE 'chain-%'
    ORDER BY "character_id"`

try {
  for (const { characterId, history, storedChain = null } of characters) {
    await recordCharacterBasic(client, {
      serverId: 'cain',
      characterId,
      ...basic(characterId, job)
    })

    if (history !== null) {
      await recordCharacterHistory(client, {
        serverId: 'cain',
        characterId,
        observedAt,
        basic: basic(characterId, history.job),
        sections: { skill_style: skillStyleBody(history.chain) },
        score: null
      })
    }

    await recordCharacterSkillStyle(client, storedStyle(characterId, storedChain))
  }

  const before = await readRows()
  const service = new SkillChainBackfillService(
    new DatabaseSkillChainBackfillRepository(client),
    parseCharacterSkillStyle
  )
  await service.backfill(() => {})
  const afterFirst = await readRows()
  await service.backfill(() => {})
  const afterSecond = await readRows()

  const unchanged = before.filter(({ characterId }) => characterId !== 'chain-same')
  assert.deepEqual(
    afterFirst.filter(({ characterId }) => characterId !== 'chain-same'),
    unchanged
  )
  assert.deepEqual(
    afterFirst.find(({ characterId }) => characterId === 'chain-same'),
    {
      characterId: 'chain-same',
      skills: [
        { name: '원문 액티브', level: 13 },
        { name: '원문 개화', level: 1 },
        { name: '원문 패시브', level: 20 }
      ],
      evolutions: [{ name: '원문 개화', type: 2 }],
      enhancements: [{ name: '원문 액티브', type: 1 }],
      chain: ['원문 개화', null, '원문 액티브', null],
      fetchedAt: observedAt
    }
  )
  assert.deepEqual(afterSecond, afterFirst)

  // 백필이 읽은 뒤 상세 조회가 체인을 저장했거나 전직이 바뀐 행이면 쓰지 않는다.
  const backfilled = {
    ...storedStyle('chain-kept', ['원문 액티브', null, null, null]),
    fetchedAt: observedAt
  }
  assert.equal(await fillCharacterSkillStyleChain(client, backfilled), false)
  assert.equal(
    await fillCharacterSkillStyleChain(client, {
      ...backfilled,
      characterId: 'chain-null',
      ...otherJob
    }),
    false
  )
  assert.deepEqual(await readRows(), afterFirst)
} finally {
  await client.$disconnect()
}
