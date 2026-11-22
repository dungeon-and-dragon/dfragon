import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createDatabaseClient, recordCharacterScore } from '../dist/index.js'

const port = process.env.DFRAGON_TEST_CHARACTER_SCORE_PORT

const character = { serverId: 'cain', characterId: 'score-fixture' }
const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }
const job = { jobId: 'synthetic-job', jobGrowId: 'synthetic-grow' }

function scoreOf(score, overrides = {}) {
  return {
    ...character,
    job,
    kind: 'equipment',
    score,
    calculatedAt: new Date('2026-11-14T00:00:00Z'),
    engine,
    approximate: null,
    ...overrides
  }
}

const approximate = {
  source: 'legacy_fusion_policy_a',
  warning: '근사값, 1% 밖일 가능성 높음: 판정 불가',
  skipped: { kind: 'resolution', message: '판정 불가' }
}

async function readStored(client) {
  const [row] = await client.$queryRaw`
    SELECT "kind", "score", "calculated_at", "engine_package", "engine_rules_rev", "engine_bundle_id",
      "job_id", "job_grow_id", "approximate_source"
    FROM "character_scores"
    WHERE "server_id" = ${character.serverId} AND "character_id" = ${character.characterId}`

  return row
}

test('같은 엔진 버전, 종류, 전직, 근사 방식에서는 높은 점수만 남기고, 버전, 종류, 전직, 근사 여부나 근사 방식이 바뀌면 낮아도 새 값으로 덮으며, 동시에 저장해도 최고값이 남는다', {
  skip: port === undefined
}, async (t) => {
  const client = createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: 'character_score_test',
    username: 'character_score_test',
    password: 'synthetic'
  })
  t.after(() => client.$disconnect())
  const migrations = await Promise.all(
    [
      '20261114130000_add_character_scores',
      '20261119180000_add_character_score_jobs',
      '20261122100000_add_character_score_approximate'
    ].map((name) =>
      readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8')
    )
  )
  await client.$executeRawUnsafe('DROP TABLE IF EXISTS "character_scores", "characters"')
  // 점수 행이 참조하는 기본 key와 전직 migration이 읽는 전직만 둔 characters다.
  await client.$executeRawUnsafe(
    'CREATE TABLE "characters" ("server_id" TEXT NOT NULL, "character_id" TEXT NOT NULL, "job_id" TEXT, "job_grow_id" TEXT, PRIMARY KEY ("server_id", "character_id"))'
  )
  await client.$executeRaw`INSERT INTO "characters" VALUES (${character.serverId}, ${character.characterId}, NULL, NULL)`
  for (const statement of migrations
    .join(';')
    .split(';')
    .map((part) => part.trim())
    // 이 테스트는 점수 이력 테이블을 만들지 않으므로 그 테이블을 바꾸는 문장은 건너뛴다.
    .filter((part) => part !== '' && !part.includes('"character_score_history"'))) {
    await client.$executeRawUnsafe(statement)
  }

  await recordCharacterScore(client, scoreOf(1741))
  await recordCharacterScore(
    client,
    scoreOf(1650, { calculatedAt: new Date('2026-11-15T00:00:00Z') })
  )
  assert.deepEqual(await readStored(client), {
    kind: 'equipment',
    score: 1741,
    calculated_at: new Date('2026-11-14T00:00:00Z'),
    engine_package: engine.package,
    engine_rules_rev: engine.rulesRev,
    engine_bundle_id: engine.bundleId,
    job_id: job.jobId,
    job_grow_id: job.jobGrowId,
    approximate_source: null
  })

  await recordCharacterScore(
    client,
    scoreOf(1800, { calculatedAt: new Date('2026-11-16T00:00:00Z') })
  )
  assert.equal((await readStored(client)).score, 1800)

  const nextEngine = { ...engine, bundleId: 'phase33-rev15a' }
  await recordCharacterScore(
    client,
    scoreOf(1500, { engine: nextEngine, calculatedAt: new Date('2026-11-17T00:00:00Z') })
  )
  assert.deepEqual(await readStored(client), {
    kind: 'equipment',
    score: 1500,
    calculated_at: new Date('2026-11-17T00:00:00Z'),
    engine_package: engine.package,
    engine_rules_rev: engine.rulesRev,
    engine_bundle_id: 'phase33-rev15a',
    job_id: job.jobId,
    job_grow_id: job.jobGrowId,
    approximate_source: null
  })

  await recordCharacterScore(client, scoreOf(900, { kind: 'buff', engine: nextEngine }))
  const buff = await readStored(client)
  assert.deepEqual({ kind: buff.kind, score: buff.score }, { kind: 'buff', score: 900 })

  const concurrent = Array.from({ length: 20 }, (_, index) => 1700 - index * 37)
  await Promise.all(
    concurrent.map((score) =>
      recordCharacterScore(client, scoreOf(score, { kind: 'buff', engine: nextEngine }))
    )
  )
  assert.equal((await readStored(client)).score, Math.max(...concurrent))

  const nextJob = { jobId: 'synthetic-job', jobGrowId: 'synthetic-next-grow' }
  await recordCharacterScore(
    client,
    scoreOf(800, { kind: 'buff', engine: nextEngine, job: nextJob })
  )
  const regrown = await readStored(client)
  assert.deepEqual([regrown.score, regrown.job_grow_id], [800, 'synthetic-next-grow'])
  await recordCharacterScore(client, scoreOf(700, { kind: 'buff', engine: nextEngine, job: null }))
  const unknownJob = await readStored(client)
  assert.deepEqual([unknownJob.score, unknownJob.job_id], [700, null])

  const unknownJobBuff = (score, overrides = {}) =>
    scoreOf(score, { kind: 'buff', engine: nextEngine, job: null, ...overrides })
  const otherApproximate = { ...approximate, source: 'input_gate_diagnostic' }
  await recordCharacterScore(client, unknownJobBuff(600, { approximate }))
  const approximated = await readStored(client)
  assert.deepEqual([approximated.score, approximated.approximate_source], [600, approximate.source])
  await recordCharacterScore(client, unknownJobBuff(500))
  const exact = await readStored(client)
  assert.deepEqual([exact.score, exact.approximate_source], [500, null])
  await recordCharacterScore(client, unknownJobBuff(450, { approximate }))
  await recordCharacterScore(client, unknownJobBuff(440, { approximate: otherApproximate }))
  const otherSource = await readStored(client)
  assert.deepEqual(
    [otherSource.score, otherSource.approximate_source],
    [440, otherApproximate.source]
  )
  await recordCharacterScore(client, unknownJobBuff(430, { approximate: otherApproximate }))
  assert.equal((await readStored(client)).score, 440)

  await client.$executeRaw`DELETE FROM "characters" WHERE "server_id" = ${character.serverId}`
  assert.equal(await readStored(client), undefined)
})
