import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  recordCharacterBasic,
  recordCharacterScore,
  recordContentClears
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_CONTENT_CLEAR_PORT
const database = 'content_clear_snapshot'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'content_clear_test',
    password: 'synthetic'
  })

// 합성 캐릭터, 점수, 클리어다.
const basic = (characterId, fame) => ({
  serverId: 'cain',
  characterId,
  characterName: `합성-${characterId}`,
  level: 115,
  jobId: 'synthetic-job',
  jobGrowId: 'synthetic-grow',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  adventureName: `합성모험단-${characterId}`,
  guildId: null,
  guildName: null,
  fame
})
const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }
const score = (characterId, value, overrides = {}) => ({
  serverId: 'cain',
  characterId,
  kind: 'equipment',
  score: value,
  calculatedAt: new Date('2026-11-12T13:00:00Z'),
  engine,
  ...overrides
})
const weekStart = new Date('2026-11-11T21:00:00Z')
const clear = (contentId, kind, characterId, clearedAt) => ({
  contentId,
  kind,
  serverId: 'cain',
  characterId,
  clearedAt: new Date(clearedAt),
  weekStart,
  ratio: null
})

function copied(maxFame, value, scoreKind = 'equipment', bundleId = engine.bundleId) {
  if (value === null) {
    return {
      max_fame: maxFame,
      score: null,
      score_kind: null,
      score_engine_package: null,
      score_engine_rules_rev: null,
      score_engine_bundle_id: null
    }
  }

  return {
    max_fame: maxFame,
    score: value,
    score_kind: scoreKind,
    score_engine_package: engine.package,
    score_engine_rules_rev: engine.rulesRev,
    score_engine_bundle_id: bundleId
  }
}

async function readSnapshots(client) {
  const rows = await client.$queryRaw`
    SELECT "content_id", "character_id", "cleared_at", "max_fame", "score", "score_kind",
      "score_engine_package", "score_engine_rules_rev", "score_engine_bundle_id"
    FROM "content_clears"
    ORDER BY "content_id", "character_id"`

  return Object.fromEntries(
    rows.map(({ content_id, character_id, cleared_at, ...snapshot }) => {
      const clearedAt = cleared_at.toISOString()

      return [`${content_id}/${character_id}`, { clearedAt, ...snapshot }]
    })
  )
}

test('클리어를 처음 저장할 때 그 시점의 최고 명성과 점수를 복사하고, 그 뒤 값이 바뀌거나 다시 저장해도 그대로 두며 지난 행은 채우지 않는다', {
  skip: port === undefined
}, async (t) => {
  const admin = connect('content_clear_test')

  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`)
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
  await admin.$disconnect()

  const environment = { ...process.env }

  t.after(() => {
    process.env = environment
  })
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1',
    DB_PORT: port,
    DB_NAME: database,
    DB_USERNAME: 'content_clear_test',
    DB_PASSWORD: 'synthetic'
  })
  await applyMigrations()

  const client = connect(database)

  t.after(() => client.$disconnect())

  await recordCharacterBasic(client, basic('scored', 70_000))
  await recordCharacterBasic(client, basic('unscored', 65_000))
  await recordCharacterBasic(client, basic('legacy', 60_000))
  await recordCharacterScore(client, score('scored', 1741))
  await recordCharacterScore(client, score('legacy', 1500))
  // 이 변경 전에 저장된 행처럼 복사 칸이 빈 클리어다.
  await client.$executeRaw`
    INSERT INTO "content_clears"
      ("content_id", "kind", "server_id", "character_id", "week_start", "cleared_at", "ratio")
    VALUES ('raid-a', 'raid', 'cain', 'legacy', ${weekStart}, ${new Date('2026-11-13T12:00:00Z')}, NULL)`

  const clears = [
    clear('raid-a', 'raid', 'scored', '2026-11-13T12:00:00Z'),
    clear('raid-a', 'raid', 'unscored', '2026-11-13T12:00:00Z'),
    clear('challenge-a', 'challenge', 'scored', '2026-11-13T13:00:00Z')
  ]

  await recordContentClears(client, clears)

  const first = {
    'challenge-a/scored': { clearedAt: '2026-11-13T13:00:00.000Z', ...copied(70_000, 1741) },
    'raid-a/legacy': { clearedAt: '2026-11-13T12:00:00.000Z', ...copied(null, null) },
    'raid-a/scored': { clearedAt: '2026-11-13T12:00:00.000Z', ...copied(70_000, 1741) },
    'raid-a/unscored': { clearedAt: '2026-11-13T12:00:00.000Z', ...copied(65_000, null) }
  }

  assert.deepEqual(await readSnapshots(client), first)

  await recordCharacterBasic(client, basic('scored', 72_000))
  await recordCharacterBasic(client, basic('unscored', 68_000))
  await recordCharacterScore(
    client,
    score('scored', 1200, { engine: { ...engine, bundleId: 'phase33-rev15a' } })
  )
  await recordCharacterScore(client, score('unscored', 900, { kind: 'buff' }))
  await recordContentClears(client, [
    ...clears,
    clear('raid-a', 'raid', 'legacy', '2026-11-13T12:00:00Z'),
    clear('raid-a', 'raid', 'scored', '2026-11-12T12:00:00Z'),
    clear('challenge-a', 'challenge', 'scored', '2026-11-12T13:00:00Z')
  ])

  assert.deepEqual(await readSnapshots(client), {
    ...first,
    'challenge-a/scored': { ...first['challenge-a/scored'], clearedAt: '2026-11-12T13:00:00.000Z' },
    'raid-a/scored': { ...first['raid-a/scored'], clearedAt: '2026-11-12T12:00:00.000Z' }
  })

  await recordContentClears(client, [clear('raid-b', 'raid', 'scored', '2026-11-13T14:00:00Z')])

  assert.deepEqual((await readSnapshots(client))['raid-b/scored'], {
    clearedAt: '2026-11-13T14:00:00.000Z',
    ...copied(72_000, 1200, 'equipment', 'phase33-rev15a')
  })
})
