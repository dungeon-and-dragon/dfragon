import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  readCharacterHistory,
  readCharacterHistorySnapshot,
  readCharacterSectionHistory,
  recordCharacter,
  recordCharacterHistory
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_CHARACTER_HISTORY_PORT
const database = 'character_history'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'history_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('history_test')

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`)
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
  } finally {
    await admin.$disconnect()
  }

  const environment = { ...process.env }
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1',
    DB_PORT: port,
    DB_NAME: database,
    DB_USERNAME: 'history_test',
    DB_PASSWORD: 'synthetic'
  })

  try {
    await applyMigrations()
  } finally {
    process.env = environment
  }

  client = connect(database)
})

after(() => client?.$disconnect())

const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }
const at = (time) => new Date(`2026-11-${time}+09:00`)
const nov10At215959 = at('10T21:59:59')
const nov10At2200 = at('10T22:00:00')
const nov12At215959 = at('12T21:59:59')
const nov12At2200 = at('12T22:00:00')
const nov13At0000 = at('13T00:00:00')
const nov14At2200 = at('14T22:00:00')
const nov16At2100 = at('16T21:00:00')
const nov16At2200 = at('16T22:00:00')
const nov17At0800 = at('17T08:00:00')
const nov17At0900 = at('17T09:00:00')
const nov17At1000 = at('17T10:00:00')
const nov17At1100 = at('17T11:00:00')
const nov17At1200 = at('17T12:00:00')
const nov20At0000 = at('20T00:00:00')

const basic = {
  characterName: '합성캐릭터',
  adventureName: '합성모험단',
  level: 115,
  jobId: 'job-a',
  jobGrowId: 'grow-a',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  fame: 98000,
  guildId: null,
  guildName: null
}

const sections = {
  status: { status: [{ name: '힘', value: 1200 }], buff: [] },
  equipment: { equipment: [{ slotId: 'WEAPON', itemId: 'item-a', reinforce: 12 }] },
  avatar: { avatar: [] },
  creature: { creature: null },
  oath: { oath: { info: { name: '합성 서약' } } },
  mist_assimilation: { mistAssimilation: null },
  skill_style: { skill: { style: { active: [], passive: [] } } },
  buff_equipment: { skill: { buff: { equipment: [] } } },
  buff_avatar: { skill: { buff: { avatar: [] } } },
  buff_creature: { skill: { buff: { creature: [] } } }
}

async function createCharacter(characterId) {
  const key = { serverId: 'cain', characterId }

  await recordCharacter(client, {
    ...key,
    characterName: basic.characterName,
    adventureName: basic.adventureName
  })

  return key
}

function historyOf(key, observedAt, overrides = {}) {
  return {
    ...key,
    observedAt,
    basic,
    sections,
    score: { kind: 'equipment', score: 1741, engine, approximate: null },
    ...overrides
  }
}

async function countRows(key) {
  const [row] = await client.$queryRaw`
    SELECT
      (SELECT count(*)::int FROM "character_basic_history" WHERE "server_id" = ${key.serverId} AND "character_id" = ${key.characterId}) AS basic,
      (SELECT count(*)::int FROM "character_section_history" WHERE "server_id" = ${key.serverId} AND "character_id" = ${key.characterId}) AS section,
      (SELECT count(*)::int FROM "character_score_history" WHERE "server_id" = ${key.serverId} AND "character_id" = ${key.characterId}) AS score`

  return row
}

async function sectionCounts(key) {
  const rows = await client.$queryRaw`
    SELECT "section", count(*)::int AS rows
    FROM "character_section_history"
    WHERE "server_id" = ${key.serverId} AND "character_id" = ${key.characterId}
    GROUP BY "section"`

  return Object.fromEntries(rows.map(({ section, rows }) => [section, rows]))
}

const oneEach = Object.fromEntries(Object.keys(sections).map((section) => [section, 1]))

test('같은 결과를 두 번 저장해도, 더 늦은 시각에 같은 값을 받아도 이력 행이 늘지 않고 기본 정보의 last_seen_at만 옮겨진다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-same')

  await recordCharacterHistory(client, historyOf(key, nov16At2200))
  await recordCharacterHistory(client, historyOf(key, nov16At2200))
  assert.deepEqual(await countRows(key), { basic: 1, section: 10, score: 1 })

  await recordCharacterHistory(client, historyOf(key, nov17At0900))
  assert.deepEqual(await countRows(key), { basic: 1, section: 10, score: 1 })
  const { basics } = await readCharacterHistory(client, key)
  assert.deepEqual(
    basics.map(({ observedAt, lastSeenAt }) => ({ observedAt, lastSeenAt })),
    [{ observedAt: nov16At2200, lastSeenAt: nov17At0900 }]
  )
})

test('섹션 하나만 바뀌면 그 섹션에만 행이 하나 늘고, 기본 정보는 last_seen_at만 옮겨진다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-section')
  await recordCharacterHistory(client, historyOf(key, nov16At2200))

  const changed = {
    ...sections,
    equipment: { equipment: [{ slotId: 'WEAPON', itemId: 'item-a', reinforce: 13 }] }
  }

  await recordCharacterHistory(client, historyOf(key, nov17At0900, { sections: changed }))

  assert.deepEqual(await sectionCounts(key), { ...oneEach, equipment: 2 })
  const history = await readCharacterHistory(client, key)
  assert.deepEqual(
    history.basics.map(({ observedAt, lastSeenAt }) => ({ observedAt, lastSeenAt })),
    [{ observedAt: nov16At2200, lastSeenAt: nov17At0900 }]
  )
  assert.equal(history.scores.length, 1)
  assert.deepEqual(
    history.sectionChanges.filter(({ section }) => section === 'equipment'),
    [
      { section: 'equipment', observedAt: nov16At2200 },
      { section: 'equipment', observedAt: nov17At0900 }
    ]
  )
})

test('기본 정보의 열이 하나라도 바뀌면 기본 정보 행이 새로 생긴다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-basic')
  await recordCharacterHistory(client, historyOf(key, nov16At2200))
  await recordCharacterHistory(
    client,
    historyOf(key, nov17At0900, {
      basic: { ...basic, guildId: 'guild-a', guildName: '합성길드' }
    })
  )

  const { basics } = await readCharacterHistory(client, key)
  assert.deepEqual(
    basics.map(({ observedAt, lastSeenAt, guildName }) => ({ observedAt, lastSeenAt, guildName })),
    [
      { observedAt: nov16At2200, lastSeenAt: nov16At2200, guildName: null },
      { observedAt: nov17At0900, lastSeenAt: nov17At0900, guildName: '합성길드' }
    ]
  )
  assert.deepEqual(await sectionCounts(key), oneEach)
})

test('jsonb key 순서만 다른 섹션은 바뀐 것으로 보지 않는다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-key-order')
  await recordCharacterHistory(client, historyOf(key, nov16At2200))

  const reordered = {
    ...sections,
    equipment: { equipment: [{ reinforce: 12, itemId: 'item-a', slotId: 'WEAPON' }] },
    status: { buff: [], status: [{ value: 1200, name: '힘' }] }
  }

  await recordCharacterHistory(client, historyOf(key, nov17At0900, { sections: reordered }))

  assert.deepEqual(await sectionCounts(key), oneEach)
})

test('last_seen_at보다 이르거나 같은 시각의 결과는 값이 달라도 아무것도 바꾸지 않는다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-late')
  await recordCharacterHistory(client, historyOf(key, nov16At2200))
  await recordCharacterHistory(client, historyOf(key, nov17At0900))
  const stored = await readCharacterHistory(client, key)

  const different = {
    basic: { ...basic, fame: 99000 },
    sections: { ...sections, avatar: { avatar: [{ slotId: 'HEADGEAR' }] } },
    score: { kind: 'equipment', score: 1900, engine, approximate: null }
  }

  await recordCharacterHistory(client, historyOf(key, nov17At0900, different))
  await recordCharacterHistory(client, historyOf(key, nov17At0800, different))
  await recordCharacterHistory(client, historyOf(key, nov16At2100, different))

  assert.deepEqual(await readCharacterHistory(client, key), stored)
  assert.deepEqual(await countRows(key), { basic: 1, section: 10, score: 1 })
})

test('점수가 null이면 점수 행이 생기지 않고, 엔진 버전만 달라져도 점수 행이 생긴다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-score')
  await recordCharacterHistory(client, historyOf(key, nov16At2200, { score: null }))
  assert.deepEqual(await countRows(key), { basic: 1, section: 10, score: 0 })

  await recordCharacterHistory(client, historyOf(key, nov17At0900))
  await recordCharacterHistory(client, historyOf(key, nov17At1000, { score: null }))
  await recordCharacterHistory(client, historyOf(key, nov17At1100))
  const nextEngine = { ...engine, bundleId: 'phase33-rev15a' }
  await recordCharacterHistory(
    client,
    historyOf(key, nov17At1200, {
      score: { kind: 'equipment', score: 1741, engine: nextEngine, approximate: null }
    })
  )

  const { scores } = await readCharacterHistory(client, key)
  assert.deepEqual(scores, [
    { observedAt: nov17At0900, kind: 'equipment', score: 1741, engine, approximate: null },
    {
      observedAt: nov17At1200,
      kind: 'equipment',
      score: 1741,
      engine: nextEngine,
      approximate: null
    }
  ])
})

test('근사 점수는 근사 방식, 경고, 건너뛴 이유와 함께 저장해 읽고, 값이 같아도 근사 여부나 근사 방식이 바뀌면 점수 행이 생긴다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-approximate')
  const approximate = {
    source: 'legacy_fusion_policy_a',
    warning: '근사값, 1% 밖일 가능성 높음: 판정 불가',
    skipped: { kind: 'resolution', message: '판정 불가' }
  }
  const otherApproximate = { ...approximate, source: 'input_gate_diagnostic' }
  const scoreWith = (approximation) => ({
    score: { kind: 'equipment', score: 1650, engine, approximate: approximation }
  })

  await recordCharacterHistory(client, historyOf(key, nov17At0800, scoreWith(approximate)))
  await recordCharacterHistory(client, historyOf(key, nov17At0900, scoreWith(approximate)))
  await recordCharacterHistory(client, historyOf(key, nov17At1000, scoreWith(null)))
  await recordCharacterHistory(client, historyOf(key, nov17At1100, scoreWith(otherApproximate)))

  const { scores } = await readCharacterHistory(client, key)
  assert.deepEqual(
    scores.map(({ observedAt, score, approximate }) => ({ observedAt, score, approximate })),
    [
      { observedAt: nov17At0800, score: 1650, approximate },
      { observedAt: nov17At1000, score: 1650, approximate: null },
      { observedAt: nov17At1100, score: 1650, approximate: otherApproximate }
    ]
  )
  const snapshot = await readCharacterHistorySnapshot(client, key, nov17At0900)
  assert.deepEqual(snapshot.score, {
    observedAt: nov17At0800,
    kind: 'equipment',
    score: 1650,
    engine,
    approximate
  })
})

test('같은 엔진 버전은 여러 캐릭터가 동시에 처음 저장해도 score_engines에 한 행만 있다', {
  skip: port === undefined
}, async () => {
  const newEngine = { ...engine, bundleId: 'phase34-concurrent' }
  const keys = await Promise.all(
    Array.from({ length: 12 }, (_, index) => createCharacter(`history-engine-${index}`))
  )

  await Promise.all(
    keys.map((key) =>
      recordCharacterHistory(
        client,
        historyOf(key, nov16At2200, {
          score: { kind: 'buff', score: 900, engine: newEngine, approximate: null }
        })
      )
    )
  )

  const [{ rows }] = await client.$queryRaw`
    SELECT count(*)::int AS rows FROM "score_engines"
    WHERE "package" = ${newEngine.package} AND "rules_rev" = ${newEngine.rulesRev} AND "bundle_id" = ${newEngine.bundleId}`

  assert.equal(rows, 1)

  for (const key of keys) {
    assert.deepEqual((await readCharacterHistory(client, key)).scores[0].engine, newEngine)
  }
})

test('같은 캐릭터의 같은 값을 서로 다른 시각으로 동시에 저장해도 행이 한 번만 생기고 last_seen_at은 가장 늦은 시각이다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-concurrent')
  const observedTimes = Array.from(
    { length: 8 },
    (_, index) => new Date(nov16At2200.getTime() + index * 60_000)
  )
  const latestTime = observedTimes.at(-1)

  await Promise.all(
    observedTimes.map((observedAt) => recordCharacterHistory(client, historyOf(key, observedAt)))
  )

  assert.deepEqual(await countRows(key), { basic: 1, section: 10, score: 1 })
  const { basics } = await readCharacterHistory(client, key)
  assert.deepEqual(basics[0].lastSeenAt, latestTime)
})

test('두 시각 사이의 T로 읽으면 섹션마다 T 이전의 최신 행과 그때의 기본 정보, 점수가 나온다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-snapshot')
  const firstEquipment = sections.equipment
  const secondEquipment = { equipment: [{ slotId: 'WEAPON', itemId: 'item-b', reinforce: 0 }] }
  const secondAvatar = { avatar: [{ slotId: 'HEADGEAR' }] }

  await recordCharacterHistory(client, historyOf(key, nov10At2200))
  await recordCharacterHistory(
    client,
    historyOf(key, nov12At2200, {
      basic: { ...basic, fame: 99000 },
      sections: { ...sections, equipment: secondEquipment },
      score: { kind: 'equipment', score: 1800, engine, approximate: null }
    })
  )
  await recordCharacterHistory(
    client,
    historyOf(key, nov14At2200, {
      basic: { ...basic, fame: 99000 },
      sections: { ...sections, equipment: secondEquipment, avatar: secondAvatar },
      score: { kind: 'equipment', score: 1800, engine, approximate: null }
    })
  )

  const between = await readCharacterHistorySnapshot(client, key, nov13At0000)
  assert.deepEqual(between.sections, { ...sections, equipment: secondEquipment })
  assert.equal(between.basic.fame, 99000)
  assert.deepEqual(between.observedAt, nov12At2200)
  assert.deepEqual(between.score, {
    observedAt: nov12At2200,
    kind: 'equipment',
    score: 1800,
    engine,
    approximate: null
  })

  const first = await readCharacterHistorySnapshot(client, key, nov12At215959)
  assert.deepEqual(first.sections, { ...sections, equipment: firstEquipment })
  assert.equal(first.basic.fame, basic.fame)
  assert.equal(first.score.score, 1741)
  assert.deepEqual(first.observedAt, nov10At2200)

  const latest = await readCharacterHistorySnapshot(client, key, nov20At0000)
  assert.deepEqual(latest.sections, {
    ...sections,
    equipment: secondEquipment,
    avatar: secondAvatar
  })
  // 기본 정보와 점수는 12일 행이 최신이지만 아바타가 14일에 바뀌었으므로 스냅샷은 14일에 받은 값이다.
  assert.deepEqual(latest.observedAt, nov14At2200)

  assert.equal(await readCharacterHistorySnapshot(client, key, nov10At215959), null)
})

test('characters에 없는 캐릭터는 FK 오류로 실패하고, 캐릭터를 지우면 이력도 지워진다', {
  skip: port === undefined
}, async () => {
  const missing = { serverId: 'cain', characterId: 'history-missing' }
  await assert.rejects(
    recordCharacterHistory(client, historyOf(missing, nov16At2200)),
    (error) => error.code === 'P2003'
  )
  assert.deepEqual(await countRows(missing), { basic: 0, section: 0, score: 0 })

  const key = await createCharacter('history-deleted')
  await recordCharacterHistory(client, historyOf(key, nov16At2200))
  await client.$executeRaw`DELETE FROM "characters" WHERE "server_id" = ${key.serverId} AND "character_id" = ${key.characterId}`
  assert.deepEqual(await countRows(key), { basic: 0, section: 0, score: 0 })
})

test('섹션 이력 읽기는 고른 섹션의 행만 받은 시각 순으로 본문과 함께 준다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('history-sections')
  const changedEquipment = { equipment: [{ slotId: 'WEAPON', itemId: 'item-a', reinforce: 13 }] }
  const changedStatus = { status: [{ name: '힘', value: 1300 }], buff: [] }

  await recordCharacterHistory(client, historyOf(key, nov16At2200))
  await recordCharacterHistory(
    client,
    historyOf(key, nov17At0900, {
      sections: { ...sections, equipment: changedEquipment, status: changedStatus }
    })
  )

  const rows = await readCharacterSectionHistory(client, key, ['equipment', 'creature'])

  assert.deepEqual(rows, [
    { section: 'creature', observedAt: nov16At2200, data: sections.creature },
    { section: 'equipment', observedAt: nov16At2200, data: sections.equipment },
    { section: 'equipment', observedAt: nov17At0900, data: changedEquipment }
  ])
})
