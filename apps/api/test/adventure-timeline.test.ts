import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type { StoredCharacter, TimelineCharacter, TimelineItemRow } from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import { parseTimelineCursor } from '@dfragon/server-core/domain/character-timeline/index.js'
import type {
  AdventureGuildRepository,
  AdventureTimelineRead
} from '../src/application/adventure-guild/repository.js'
import {
  type AdventureTimelineEntry,
  type AdventureTimelineQuery,
  toAdventureTimelinePage
} from '../src/domain/adventure-guild/index.js'
import { toAdventureTimelineEntry } from '../src/infrastructure/database/adventure-timeline.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

const MERGES_CHARACTERS = '여러 캐릭터의 기록을 시각 내림차순, 같은 시각이면 id 오름차순으로 합친다'
const PAGE_CURSOR =
  '합친 기록이 50개를 넘으면 50번째 행을 가리키는 cursor를, 넘지 않으면 null을 준다'
const DROPPED_ROW = '형식이 맞지 않아 뺀 강화 행도 묶음의 개수와 cursor에 든다'
const ROW_TYPES =
  '강화 행은 종류를 나눈 enhancement로, 획득 행은 acquisition으로 캐릭터 이름과 함께 준다'
const ROUTE =
  '타임라인 조회는 kind와 before를 읽어 넘기고, 첫 묶음을 줄 때만 캐릭터마다 동기화를 요청한다'
const INVALID_QUERY = 'kind, before가 잘못됐거나 다른 query가 있으면 400으로 거절한다'

// 합성 캐릭터와 기록이다.
const cain = { serverId: 'cain', characterId: 'a', characterName: '합성가' }
const siroco = { serverId: 'siroco', characterId: 'b', characterName: '합성나' }

function entry(
  character: typeof cain,
  time: string,
  id: bigint,
  itemName = `합성 ${id}`
): AdventureTimelineEntry {
  const occurredAt = new Date(`2026-11-20T${time}:00+09:00`)
  const item = {
    ...character,
    type: 'acquisition' as const,
    code: 505,
    name: '아이템 획득(레이드 카드 보상)',
    itemId: null,
    itemName,
    itemRarity: '에픽',
    occurredAt
  }

  return { id, occurredAt, items: [item] }
}

function row(fields: Partial<TimelineItemRow> & Pick<TimelineItemRow, 'code'>): TimelineItemRow {
  return {
    id: 1n,
    occurredAt: new Date('2026-11-20T12:00:00+09:00'),
    name: '합성',
    itemId: null,
    itemName: '합성 장비',
    itemRarity: '에픽',
    data: {},
    ...fields
  }
}

function itemNames(entries: readonly AdventureTimelineEntry[]): string[] {
  return toAdventureTimelinePage(entries).items.map(
    (item) => `${item.characterId}/${item.itemName}`
  )
}

test(MERGES_CHARACTERS, () => {
  const entries = [
    entry(cain, '10:00', 5n, '가 10시'),
    entry(siroco, '12:00', 9n, '나 12시 뒤'),
    entry(cain, '12:00', 3n, '가 12시 앞'),
    entry(siroco, '11:00', 1n, '나 11시')
  ]

  assert.deepEqual(itemNames(entries), ['a/가 12시 앞', 'b/나 12시 뒤', 'b/나 11시', 'a/가 10시'])
})

test(PAGE_CURSOR, () => {
  const fifty = Array.from({ length: 50 }, (_, index) => entry(cain, '12:00', BigInt(index + 1)))
  const older = entry(siroco, '11:00', 100n)
  const full = toAdventureTimelinePage([older, ...fifty])
  const cursor = full.nextCursor === null ? undefined : parseTimelineCursor(full.nextCursor)

  assert.equal(full.items.length, 50)
  assert.deepEqual(cursor, {
    occurredAt: new Date('2026-11-20T12:00:00+09:00'),
    id: 50n
  })
  assert.equal(toAdventureTimelinePage(fifty).nextCursor, null)
})

test(DROPPED_ROW, () => {
  const dropped = { ...entry(cain, '12:00', 50n), items: [] }
  const fortyNine = Array.from({ length: 49 }, (_, index) =>
    entry(cain, '12:00', BigInt(index + 1))
  )
  const page = toAdventureTimelinePage([...fortyNine, dropped, entry(siroco, '11:00', 100n)])

  assert.equal(page.items.length, 49)
  assert.notEqual(page.nextCursor, null)
})

test(ROW_TYPES, () => {
  const refine = toAdventureTimelineEntry(
    cain,
    row({ id: 7n, code: 403, data: { after: 8, result: true } })
  )
  const broken = toAdventureTimelineEntry(cain, row({ code: 401, data: { after: '+12' } }))
  const acquisition = toAdventureTimelineEntry(
    siroco,
    row({ code: 557, name: '서약 획득', itemRarity: '태초' })
  )

  assert.deepEqual(refine, {
    id: 7n,
    occurredAt: new Date('2026-11-20T12:00:00+09:00'),
    items: [
      {
        ...cain,
        type: 'enhancement',
        kind: 'refine',
        itemId: null,
        itemName: '합성 장비',
        itemRarity: '에픽',
        before: null,
        after: 8,
        result: true,
        safe: null,
        occurredAt: new Date('2026-11-20T12:00:00+09:00')
      }
    ]
  })
  assert.deepEqual(broken.items, [])
  assert.deepEqual(acquisition.items, [
    {
      ...siroco,
      type: 'acquisition',
      code: 557,
      name: '서약 획득',
      itemId: null,
      itemName: '합성 장비',
      itemRarity: '태초',
      occurredAt: new Date('2026-11-20T12:00:00+09:00')
    }
  ])
})

const unusedRead = async (): Promise<never> => assert.fail('부르면 안 된다')

function adventureCharacter({
  serverId,
  characterId,
  characterName
}: typeof cain): StoredCharacter {
  return {
    serverId,
    characterId,
    characterName,
    adventureName: '합성 모험단',
    level: null,
    jobId: null,
    jobGrowId: null,
    jobName: null,
    jobGrowName: null,
    fame: null,
    guildId: null,
    guildName: null,
    fetchedAt: null,
    dealerSkillLearned: null,
    score: null
  }
}

async function listen(
  readAdventureTimeline: AdventureGuildRepository['readAdventureTimeline'],
  sync: (character: TimelineCharacter) => Promise<void>
): Promise<{ app: HttpAppHandle; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    adventureGuild: {
      readAdventureCharacters: unusedRead,
      readGuild: unusedRead,
      readAdventureWeeklyClears: unusedRead,
      readAdventureEquipment: unusedRead,
      readAdventureTimeline,
      readAdventureActivity: unusedRead,
      readAdventureSeasonDays: unusedRead,
      readAdventureSeasonBackfill: unusedRead
    },
    timeline: {
      sync,
      read: unused,
      readPage: unused,
      backfillEnhancements: unused,
      backfillSeason: unused,
      close: async () => undefined
    },
    writeAccessLog: () => undefined
  })

  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return { app, origin }
}

test(ROUTE, async () => {
  const queries: [string, AdventureTimelineQuery][] = []
  const requested: TimelineCharacter[] = []
  const page = toAdventureTimelinePage([entry(cain, '12:00', 1n, '합성 상의')])
  const read: AdventureTimelineRead = {
    characters: [adventureCharacter(cain), adventureCharacter(siroco)],
    page
  }
  const { app, origin } = await listen(
    async (adventureName, query) => {
      queries.push([adventureName, query])

      return read
    },
    (character) => {
      requested.push(character)

      return Promise.resolve()
    }
  )

  try {
    const path = `/adventures/${encodeURIComponent('합성 모험단')}/timeline`
    const first = await fetch(new URL(`${path}?kind=acquisition`, origin))

    assert.equal(first.status, 200)
    assert.deepEqual(await first.json(), {
      items: [
        {
          ...cain,
          type: 'acquisition',
          code: 505,
          name: '아이템 획득(레이드 카드 보상)',
          itemId: null,
          itemName: '합성 상의',
          itemRarity: '에픽',
          occurredAt: '2026-11-20T03:00:00.000Z'
        }
      ],
      nextCursor: null
    })

    while (requested.length < 2) {
      await nextTurn()
    }

    const before = '1763607600000.42'
    const next = await fetch(new URL(`${path}?before=${before}`, origin))

    assert.equal(next.status, 200)

    // 동기화 요청은 queue를 거쳐 다음 차례에 불리므로 몇 차례 넘긴 뒤에도 늘지 않았는지 본다.
    for (let turn = 0; turn < 5; turn++) {
      await nextTurn()
    }

    assert.deepEqual(queries, [
      ['합성 모험단', { kind: 'acquisition' }],
      ['합성 모험단', { kind: undefined, before: parseTimelineCursor(before) }]
    ])
    assert.deepEqual(requested, [
      { serverId: 'cain', characterId: 'a' },
      { serverId: 'siroco', characterId: 'b' }
    ])
  } finally {
    await app.close()
  }
})

test(INVALID_QUERY, async () => {
  const { app, origin } = await listen(unusedRead, unusedRead)

  try {
    for (const query of ['kind=clear', 'before=abc', 'kind=amplify&kind=refine', 'season=11']) {
      const response = await fetch(new URL(`/adventures/합성/timeline?${query}`, origin))

      assert.equal(response.status, 400, query)
      assert.equal((await response.json()).error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})
