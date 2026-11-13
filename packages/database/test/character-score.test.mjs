import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createDatabaseClient, recordCharacterScore } from '../dist/index.js'

const port = process.env.DFRAGON_TEST_CHARACTER_SCORE_PORT

const character = { serverId: 'cain', characterId: 'score-fixture' }
const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }

function scoreOf(score, overrides = {}) {
  return {
    ...character,
    kind: 'equipment',
    score,
    calculatedAt: new Date('2026-11-14T00:00:00Z'),
    engine,
    ...overrides
  }
}

async function readStored(client) {
  const [row] = await client.$queryRaw`
    SELECT "kind", "score", "calculated_at", "engine_package", "engine_rules_rev", "engine_bundle_id"
    FROM "character_scores"
    WHERE "server_id" = ${character.serverId} AND "character_id" = ${character.characterId}`

  return row
}

test('같은 엔진 버전과 종류에서는 높은 점수만 남기고, 버전이나 종류가 바뀌면 낮아도 새 값으로 덮으며, 동시에 저장해도 최고값이 남는다', {
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
  const migration = await readFile(
    new URL(
      '../prisma/migrations/20261114130000_add_character_scores/migration.sql',
      import.meta.url
    ),
    'utf8'
  )
  await client.$executeRawUnsafe('DROP TABLE IF EXISTS "character_scores", "characters"')
  // 점수 행이 참조하는 기본 key만 둔 characters다.
  await client.$executeRawUnsafe(
    'CREATE TABLE "characters" ("server_id" TEXT NOT NULL, "character_id" TEXT NOT NULL, PRIMARY KEY ("server_id", "character_id"))'
  )
  await client.$executeRaw`INSERT INTO "characters" VALUES (${character.serverId}, ${character.characterId})`
  for (const statement of migration
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
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
    engine_bundle_id: engine.bundleId
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
    engine_bundle_id: 'phase33-rev15a'
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

  await client.$executeRaw`DELETE FROM "characters" WHERE "server_id" = ${character.serverId}`
  assert.equal(await readStored(client), undefined)
})
