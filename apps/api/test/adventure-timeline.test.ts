import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type {
  RecentTimelineEventRow,
  StoredCharacter,
  TimelineCharacter,
  TimelineItemRow
} from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type {
  AdventureGuildRepository,
  AdventureTimelineRead
} from '../src/application/adventure-guild/repository.js'
import {
  type AdventureTimelineEntry,
  type AdventureTimelineItem,
  type AdventureTimelineQuery,
  type AdventureTimelineSource,
  parseAdventureTimelineCursor,
  toAdventureTimelinePage,
  toSourceCursor
} from '../src/domain/adventure-guild/index.js'
import {
  toAdventureTimelineEventEntry,
  toAdventureTimelineItemEntry,
  toTimelineReads
} from '../src/infrastructure/database/adventure-timeline.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'
import { syncRequestRecorder } from './timeline-request-fixtures.js'

const MERGES_CHARACTERS = '여러 캐릭터의 기록을 시각 내림차순, 같은 시각이면 id 오름차순으로 합친다'
const SAME_TIME_SOURCES = '같은 시각이면 강화와 획득을 클리어보다 앞에 둔다'
const SOURCE_CURSOR =
  'cursor를 테이블별 cursor로 바꿀 때 같은 테이블은 그대로, 앞 테이블은 그 시각의 id를 모두 지난 값, 뒤 테이블은 그 시각의 id를 하나도 지나지 않은 값으로 둔다'
const READS =
  '종류가 없으면 강화와 증폭, 에픽과 태초 획득, 레이드 클리어를 읽고, 재련과 레기온은 어느 종류에서도 읽지 않는다'
const PAGE_CURSOR =
  '합친 기록이 50개를 넘으면 50번째 행을 가리키는 cursor를, 넘지 않으면 null을 준다'
const DROPPED_ROW = '형식이 맞지 않아 뺀 강화 행도 묶음의 개수와 cursor에 든다'
const ROW_TYPES =
  '강화 행은 enhancement, 획득 행은 acquisition, 레이드 클리어 행은 clear로 캐릭터 이름과 함께 주고, 형식이 맞지 않는 행은 비운다'
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
  itemName = `합성 ${id}`,
  source: AdventureTimelineSource = 'item'
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

  return { source, id, occurredAt, items: [item] }
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

function label(item: AdventureTimelineItem): string | null {
  if (item.type === 'clear') {
    return item.name
  }

  return item.itemName
}

function itemNames(entries: readonly AdventureTimelineEntry[]): string[] {
  return toAdventureTimelinePage(entries).items.map((item) => `${item.characterId}/${label(item)}`)
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

test(SAME_TIME_SOURCES, () => {
  const entries = [
    entry(cain, '12:00', 1n, '가 클리어', 'event'),
    entry(siroco, '12:00', 9n, '나 획득'),
    entry(cain, '11:00', 3n, '가 11시 클리어', 'event')
  ]

  assert.deepEqual(itemNames(entries), ['b/나 획득', 'a/가 클리어', 'a/가 11시 클리어'])
})

test(SOURCE_CURSOR, () => {
  const occurredAt = new Date('2026-11-20T12:00:00+09:00')
  const atItem = { occurredAt, source: 'item' as const, id: 5n }
  const atEvent = { occurredAt, source: 'event' as const, id: 5n }

  assert.deepEqual(toSourceCursor(atItem, 'item'), { occurredAt, id: 5n })
  assert.deepEqual(toSourceCursor(atItem, 'event'), { occurredAt, id: -1n })
  assert.deepEqual(toSourceCursor(atEvent, 'item'), { occurredAt, id: 2n ** 63n - 1n })
  assert.deepEqual(toSourceCursor(atEvent, 'event'), { occurredAt, id: 5n })
})

test(READS, () => {
  const codesOf = (kind?: AdventureTimelineQuery['kind']) =>
    toTimelineReads(kind).map((read) => {
      if (read.source === 'event') {
        return [read.source, read.codes]
      }

      return [read.source, read.filter.codes, read.filter.itemRarities]
    })
  const acquisitionCodes = [
    501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519,
    520, 521, 550, 551, 552, 553, 554, 555, 556, 557
  ]

  assert.deepEqual(codesOf(), [
    ['item', [401, 402], undefined],
    ['item', acquisitionCodes, ['에픽', '태초']],
    ['event', [201, 210]]
  ])
  assert.deepEqual(codesOf('enhancement'), [['item', [401, 402], undefined]])
  assert.deepEqual(codesOf('clear'), [['event', [201, 210]]])
})

test(PAGE_CURSOR, () => {
  const fifty = Array.from({ length: 50 }, (_, index) => entry(cain, '12:00', BigInt(index + 1)))
  const older = entry(siroco, '11:00', 100n)
  const full = toAdventureTimelinePage([older, ...fifty])
  const cursor =
    full.nextCursor === null ? undefined : parseAdventureTimelineCursor(full.nextCursor)

  assert.equal(full.items.length, 50)
  assert.deepEqual(cursor, {
    occurredAt: new Date('2026-11-20T12:00:00+09:00'),
    source: 'item',
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

function clearRow(
  fields: Partial<RecentTimelineEventRow> & Pick<RecentTimelineEventRow, 'code'>
): RecentTimelineEventRow {
  return {
    id: 3n,
    occurredAt: new Date('2026-11-20T12:00:00+09:00'),
    name: '레이드',
    raidName: '합성 레이드',
    data: { modeName: '합성 단계', hard: true },
    ...fields
  }
}

test(ROW_TYPES, () => {
  const amplify = toAdventureTimelineItemEntry(
    cain,
    row({ id: 7n, code: 402, data: { before: 10, after: 11, result: false, safe: true } })
  )
  const broken = toAdventureTimelineItemEntry(cain, row({ code: 401, data: { after: '+12' } }))
  const acquisition = toAdventureTimelineItemEntry(
    siroco,
    row({ code: 557, name: '서약 획득', itemRarity: '태초' })
  )
  const clear = toAdventureTimelineEventEntry(siroco, clearRow({ code: 201 }))
  const brokenClear = toAdventureTimelineEventEntry(
    siroco,
    clearRow({ code: 210, data: {}, raidName: null })
  )
  const occurredAt = new Date('2026-11-20T12:00:00+09:00')

  assert.deepEqual(amplify, {
    source: 'item',
    id: 7n,
    occurredAt,
    items: [
      {
        ...cain,
        type: 'enhancement',
        kind: 'amplify',
        itemId: null,
        itemName: '합성 장비',
        itemRarity: '에픽',
        before: 10,
        after: 11,
        result: false,
        safe: true,
        occurredAt
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
      occurredAt
    }
  ])
  assert.deepEqual(clear, {
    source: 'event',
    id: 3n,
    occurredAt,
    items: [
      {
        ...siroco,
        type: 'clear',
        kind: 'raid',
        name: '합성 레이드',
        modeName: '합성 단계',
        hard: true,
        occurredAt
      }
    ]
  })
  assert.deepEqual(brokenClear.items, [])
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
      requests: syncRequestRecorder(sync),
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

    const before = '1763607600000.1.42'
    const next = await fetch(new URL(`${path}?before=${before}`, origin))

    assert.equal(next.status, 200)

    // 동기화 요청은 queue를 거쳐 다음 차례에 불리므로 몇 차례 넘긴 뒤에도 늘지 않았는지 본다.
    for (let turn = 0; turn < 5; turn++) {
      await nextTurn()
    }

    assert.deepEqual(queries, [
      ['합성 모험단', { kind: 'acquisition' }],
      ['합성 모험단', { kind: undefined, before: parseAdventureTimelineCursor(before) }]
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
    for (const query of [
      'kind=refine',
      'kind=amplify',
      'before=abc',
      'before=1763607600000.42',
      'kind=clear&kind=acquisition',
      'season=11'
    ]) {
      const response = await fetch(new URL(`/adventures/합성/timeline?${query}`, origin))

      assert.equal(response.status, 400, query)
      assert.equal((await response.json()).error.code, 'INVALID_CHARACTER_QUERY', query)
    }
  } finally {
    await app.close()
  }
})
