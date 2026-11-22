import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type {
  StoredCharacterHistory,
  StoredCharacterHistorySnapshot,
  TimelineEventRow
} from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { CharacterHistoryRepository } from '../src/application/character-history/repository.js'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import { toSectionBodies } from '@dfragon/server-core/domain/character-history/index.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../src/runtime/api-app.js'

const unused = async (): Promise<never> => assert.fail('부르면 안 된다')

// 실응답 fixture는 익명화로 모험단 이름과 명성이 비어 있어 합성 값을 모든 섹션 헤더에 넣는다. 길드는 비어 있는 그대로 둔다.
function readSections(): CharacterPayloads {
  const url = new URL(
    '../../../../packages/server-core/test/fixtures/character-card-dealer.json',
    import.meta.url
  )
  const { sections } = JSON.parse(readFileSync(url, 'utf8')) as { sections: CharacterPayloads }
  const syntheticHeader = { adventureName: '합성모험단', fame: 60_000 }
  const filled: CharacterPayloads = { ...sections }

  for (const section of Object.keys(sections) as (keyof CharacterPayloads)[]) {
    filled[section] = { ...sections[section], ...syntheticHeader }
  }

  return filled
}

const sections = readSections()
const character = {
  serverId: String(sections.basic.serverId),
  characterId: String(sections.basic.characterId)
}
const basic = {
  characterName: String(sections.basic.characterName),
  adventureName: '합성모험단',
  level: Number(sections.basic.level),
  jobId: String(sections.basic.jobId),
  jobGrowId: String(sections.basic.jobGrowId),
  jobName: String(sections.basic.jobName),
  jobGrowName: String(sections.basic.jobGrowName),
  fame: 60_000,
  guildId: null,
  guildName: null
}
const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }
const firstAt = new Date('2026-11-12T13:00:00Z')
const secondAt = new Date('2026-11-19T13:00:00Z')
// 기본 정보와 점수는 firstAt 뒤로 그대로이고 섹션만 이때 바뀐 스냅샷이다.
const sectionChangedAt = new Date('2026-11-12T20:00:00Z')

const storedHistory: StoredCharacterHistory = {
  basics: [
    { ...basic, observedAt: firstAt, lastSeenAt: firstAt },
    { ...basic, fame: 61_000, observedAt: secondAt, lastSeenAt: new Date('2026-11-20T01:00:00Z') }
  ],
  scores: [{ observedAt: firstAt, kind: 'equipment', score: 1741, engine, approximate: null }],
  sectionChanges: [
    { section: 'avatar', observedAt: firstAt },
    { section: 'equipment', observedAt: firstAt },
    { section: 'equipment', observedAt: secondAt }
  ]
}

const nameChangeEvents: TimelineEventRow[] = [
  {
    code: 102,
    occurredAt: new Date('2026-11-15T03:00:00Z'),
    name: '캐릭터명 변경',
    raidName: null,
    data: { beforeName: '예전이름', afterName: '지금이름' }
  },
  {
    code: 105,
    occurredAt: new Date('2026-11-16T03:00:00Z'),
    name: '모험단명 변경',
    raidName: null,
    data: { beforeName: '예전모험단', afterName: '합성모험단' }
  },
  // 이름이 없는 기록은 목록에 넣지 않는다.
  {
    code: 102,
    occurredAt: new Date('2026-11-17T03:00:00Z'),
    name: '캐릭터명 변경',
    raidName: null,
    data: {}
  }
]

function snapshotOf(
  score: StoredCharacterHistorySnapshot['score']
): StoredCharacterHistorySnapshot {
  return {
    observedAt: sectionChangedAt,
    basic: { ...basic, observedAt: firstAt, lastSeenAt: sectionChangedAt },
    score,
    sections: toSectionBodies(sections)
  }
}

function repository(
  overrides: Partial<CharacterHistoryRepository> = {}
): CharacterHistoryRepository {
  return {
    readHistory: async () => storedHistory,
    readSnapshot: async () => snapshotOf(null),
    readNameChangeEvents: async () => nameChangeEvents,
    readSections: async () => [],
    ...overrides
  }
}

async function listen(
  options: Pick<ApiHttpAppOptions, 'characterHistory' | 'details' | 'timeline'> = {
    details: { fetchDetails: unused, catalog: new CatalogService(unused) }
  }
): Promise<{ app: HttpAppHandle; origin: string }> {
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unused },
    todayGrade: { fetchShopGrade: unused },
    writeAccessLog: () => undefined,
    ...options
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
}

const historyPath = `/characters/${character.serverId}/${character.characterId}/history`

async function getJson(origin: string, path: string) {
  const response = await fetch(new URL(path, origin))

  return { status: response.status, body: await response.json() }
}

test('history는 기본 정보, 점수, 섹션별 변경 시각을 주고 타임라인의 이름 변경을 바꾸기 전과 후로 준다', async (t) => {
  const { app, origin } = await listen({
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
    characterHistory: repository(),
    timeline: {
      sync: unused,
      backfillEnhancements: unused,
      backfillSeason: unused,
      read: unused,
      readPage: unused,
      close: async () => undefined
    }
  })
  t.after(() => app.close())

  const { status, body } = await getJson(origin, historyPath)

  assert.equal(status, 200)
  assert.deepEqual(body, {
    lastSeenAt: '2026-11-20T01:00:00.000Z',
    basics: [
      { ...basic, observedAt: firstAt.toISOString() },
      { ...basic, fame: 61_000, observedAt: secondAt.toISOString() }
    ],
    scores: [
      {
        observedAt: firstAt.toISOString(),
        calculator: 'equipment',
        value: 1741,
        approximate: null,
        versions: engine
      }
    ],
    sectionChanges: {
      avatar: [firstAt.toISOString()],
      equipment: [firstAt.toISOString(), secondAt.toISOString()]
    },
    nameChanges: [
      { kind: 'character', at: '2026-11-15T03:00:00.000Z', before: '예전이름', after: '지금이름' },
      {
        kind: 'adventure',
        at: '2026-11-16T03:00:00.000Z',
        before: '예전모험단',
        after: '합성모험단'
      }
    ],
    changes: [{ observedAt: firstAt.toISOString(), first: true, items: [] }]
  })
})

test('이력이 없는 캐릭터의 history는 빈 목록이고 snapshot은 404다', async (t) => {
  const { app, origin } = await listen({
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
    characterHistory: repository({
      readHistory: async () => ({ basics: [], scores: [], sectionChanges: [] }),
      readSnapshot: async () => null,
      readNameChangeEvents: async () => []
    })
  })
  t.after(() => app.close())

  const history = await getJson(origin, historyPath)
  const snapshot = await getJson(origin, `${historyPath}/snapshot?at=2026-11-13T00:00:00Z`)

  assert.deepEqual(history, {
    status: 200,
    body: {
      lastSeenAt: null,
      basics: [],
      scores: [],
      sectionChanges: {},
      nameChanges: [],
      changes: []
    }
  })
  assert.equal(snapshot.status, 404)
  assert.equal(snapshot.body.error.code, 'CHARACTER_NOT_FOUND')
})

test('DB 설정이 없는 API는 history에 빈 목록, snapshot에 404를 준다', async (t) => {
  const { app, origin } = await listen()
  t.after(() => app.close())

  const history = await getJson(origin, historyPath)
  const snapshot = await getJson(origin, `${historyPath}/snapshot?at=2026-11-13T00:00:00Z`)

  assert.deepEqual(history.body, {
    lastSeenAt: null,
    basics: [],
    scores: [],
    sectionChanges: {},
    nameChanges: [],
    changes: []
  })
  assert.equal(snapshot.status, 404)
})

test('snapshot의 at이 없거나 ISO 시각이 아니면 400 INVALID_CHARACTER_QUERY이고 저장소를 읽지 않는다', async (t) => {
  const { app, origin } = await listen({
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
    characterHistory: repository({ readSnapshot: unused })
  })
  t.after(() => app.close())

  for (const query of [
    '',
    '?at=',
    '?at=2026-11-13',
    '?at=yesterday',
    '?at=2026-11-13T00:00:00Z&at=2026-11-14T00:00:00Z'
  ]) {
    const { status, body } = await getJson(origin, `${historyPath}/snapshot${query}`)

    assert.equal(status, 400, query)
    assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
  }
})

test('snapshot은 받은 시각까지 저장한 본문으로 지금 상세 조회와 같은 응답을 만들고 점수는 다시 계산하지 않고 이력 값을 쓴다', async (t) => {
  const requested: Date[] = []
  const history = await listen({
    details: { fetchDetails: unused, catalog: new CatalogService(async () => new Map()) },
    characterHistory: repository({
      readSnapshot: async (_character, at) => {
        requested.push(at)

        return snapshotOf({
          observedAt: firstAt,
          kind: 'equipment',
          score: 1741,
          engine,
          approximate: null
        })
      }
    })
  })
  t.after(() => history.app.close())
  const detail = await listen({
    details: {
      fetchDetails: async () => sections,
      catalog: new CatalogService(async () => new Map())
    }
  })
  t.after(() => detail.app.close())

  const snapshot = await getJson(
    history.origin,
    `${historyPath}/snapshot?at=2026-11-13T09:00:00%2B09:00`
  )
  const current = await getJson(
    detail.origin,
    `/characters/${character.serverId}/${character.characterId}`
  )

  assert.equal(snapshot.status, 200)
  assert.deepEqual(requested, [new Date('2026-11-13T00:00:00Z')])
  const { freshness, sections: metadata, card, ...content } = snapshot.body
  const {
    freshness: _freshness,
    sections: _metadata,
    card: currentCard,
    ...currentContent
  } = current.body
  assert.deepEqual(content, currentContent)
  assert.equal(freshness.lastSuccessfulFetchAt, sectionChangedAt.toISOString())
  assert.deepEqual(metadata.equipment, {
    revision: 1,
    contentUpdatedAt: sectionChangedAt.toISOString(),
    lastSuccessfulFetchAt: sectionChangedAt.toISOString()
  })
  assert.deepEqual(Object.keys(metadata), Object.keys(current.body.sections))
  assert.equal(card.role, currentCard.role)
  assert.deepEqual(card.score, {
    calculator: 'equipment',
    value: 1741,
    skipped: null,
    approximate: null,
    versions: engine
  })
})

test('근사값으로 저장한 점수 이력은 snapshot card.score에서 점수 없이 건너뛴 이유와 근사값으로, history 점수 목록에서는 근사값과 근사 방식으로 준다', async (t) => {
  const approximate = {
    source: 'legacy_fusion_policy_a',
    warning: '근사값, 1% 밖일 가능성 높음: 판정 불가',
    skipped: { kind: 'resolution', message: '판정 불가' }
  }
  const approximateScore = {
    observedAt: secondAt,
    kind: 'equipment',
    score: 1650,
    engine,
    approximate
  }
  const { app, origin } = await listen({
    details: { fetchDetails: unused, catalog: new CatalogService(async () => new Map()) },
    characterHistory: repository({
      readHistory: async () => ({
        ...storedHistory,
        scores: [...storedHistory.scores, approximateScore]
      }),
      readSnapshot: async () => snapshotOf(approximateScore)
    })
  })
  t.after(() => app.close())

  const snapshot = await getJson(origin, `${historyPath}/snapshot?at=2026-11-20T00:00:00Z`)
  const history = await getJson(origin, historyPath)

  assert.equal(snapshot.status, 200)
  assert.deepEqual(snapshot.body.card.score, {
    calculator: 'equipment',
    value: null,
    skipped: { kind: 'resolution', message: '판정 불가' },
    approximate: {
      value: 1650,
      source: 'legacy_fusion_policy_a',
      warning: '근사값, 1% 밖일 가능성 높음: 판정 불가'
    },
    versions: engine
  })
  assert.equal(history.status, 200)
  assert.deepEqual(history.body.scores, [
    {
      observedAt: firstAt.toISOString(),
      calculator: 'equipment',
      value: 1741,
      approximate: null,
      versions: engine
    },
    {
      observedAt: secondAt.toISOString(),
      calculator: 'equipment',
      value: 1650,
      approximate: { source: 'legacy_fusion_policy_a' },
      versions: engine
    }
  ])
})

test('점수 이력이 없는 시각의 snapshot은 card.score가 null이다', async (t) => {
  const { app, origin } = await listen({
    details: { fetchDetails: unused, catalog: new CatalogService(async () => new Map()) },
    characterHistory: repository()
  })
  t.after(() => app.close())

  const { status, body } = await getJson(origin, `${historyPath}/snapshot?at=2026-11-13T00:00:00Z`)

  assert.equal(status, 200)
  assert.equal(body.card.score, null)
})

test('history의 변경점은 저장한 장비 섹션끼리 비교한 시점만 주고, 엔진 버전만 다른 점수 행은 시점을 만들지 않는다', async (t) => {
  const bodies = toSectionBodies(sections)
  const equipment = bodies.equipment.equipment as Record<string, unknown>[]
  const refinedEquipment = equipment.map((item) =>
    item.slotId === 'WEAPON' ? { ...item, refine: 8 } : item
  )
  const refined = { ...bodies.equipment, equipment: refinedEquipment }
  const engineChangedAt = new Date('2026-11-15T13:00:00Z')
  const requestedSections: (readonly string[])[] = []
  const { app, origin } = await listen({
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
    characterHistory: repository({
      readHistory: async () => ({
        ...storedHistory,
        scores: [
          { observedAt: firstAt, kind: 'equipment', score: 1741, engine, approximate: null },
          {
            observedAt: engineChangedAt,
            kind: 'equipment',
            score: 1741,
            engine: { ...engine, bundleId: 'phase33-rev15a' },
            approximate: null
          }
        ]
      }),
      readSections: async (_character, requested) => {
        requestedSections.push(requested)

        return [
          { section: 'equipment', observedAt: firstAt, data: bodies.equipment },
          { section: 'equipment', observedAt: secondAt, data: refined }
        ]
      }
    })
  })
  t.after(() => app.close())

  const { body } = await getJson(origin, historyPath)

  assert.equal(requestedSections.length, 1)
  assert.deepEqual(new Set(requestedSections[0]), new Set(['equipment', 'creature']))
  assert.deepEqual(
    body.changes.map(({ observedAt, first }: { observedAt: string; first: boolean }) => ({
      observedAt,
      first
    })),
    [
      { observedAt: firstAt.toISOString(), first: true },
      { observedAt: secondAt.toISOString(), first: false }
    ]
  )
  assert.deepEqual(body.changes[1].items[0].fields, [
    { field: 'refine', name: null, before: 0, after: 8 }
  ])
})
