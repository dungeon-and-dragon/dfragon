import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  ItemDictionaryEntry,
  TimelineItemInput,
  TimelineRange,
  TimelineSyncState
} from '@dfragon/database'
import { ItemDictionaryService } from '../src/application/item-dictionary/index.js'
import type { FetchItemDetails } from '../src/application/item-dictionary/ports.js'
import type { ItemDictionaryRepository } from '../src/application/item-dictionary/repository.js'
import type { TimelineInputs } from '../src/domain/character-timeline/index.js'
import type { TimelineSyncRepository } from '../src/application/character-timeline/repository.js'
import { TimelineSyncService } from '../src/application/character-timeline/sync.js'

const SAVES_UNLISTED_ITEMS =
  '사전에 없는 레전더리 이상 장비와 모든 등급의 서약 획득 itemId를 아이템 상세로 조회해 세트, 부위, 등급과 함께 저장한다'
const SKIPS_LISTED_ITEMS = '사전에 있는 itemId만 받으면 아이템 상세를 조회하지 않는다'
const KEEPS_MISSING_ROWS =
  'Neople이 행을 주지 않은 itemId는 모든 열이 null인 행으로 남아 다시 조회하지 않는다'
const SYNC_SURVIVES_FAILURE =
  '아이템 상세 조회가 실패해도 타임라인 구간과 동기화 성공을 기록하고 실패만 보고한다'

// 합성 itemId와 아이템 상세다. 실제 Neople 응답의 itemType 값(장비 4종, 칭호는 액세서리)과 무기에 세트가 없는 모양을 흉내 냈다.
const ids = {
  weapon: 'a'.repeat(32),
  title: 'b'.repeat(32),
  fusionStone: 'c'.repeat(32),
  missing: 'd'.repeat(32),
  rare: 'e'.repeat(32),
  oath: 'f'.repeat(32),
  armor: '1'.repeat(32),
  craftedOath: '2'.repeat(32)
}
const setItemId = '9'.repeat(32)
const details: Record<string, Record<string, unknown>> = {
  [ids.weapon]: {
    itemId: ids.weapon,
    itemName: '합성 무기',
    itemType: '무기',
    itemTypeDetail: '대검',
    itemRarity: '태초',
    itemAvailableLevel: 115,
    setItemId: null,
    setItemName: null
  },
  [ids.armor]: {
    itemId: ids.armor,
    itemName: '합성 상의',
    itemType: '방어구',
    itemTypeDetail: '상의',
    itemRarity: '에픽',
    itemAvailableLevel: 115,
    setItemId,
    setItemName: '합성 세트'
  },
  [ids.title]: {
    itemId: ids.title,
    itemName: '합성 칭호',
    itemType: '액세서리',
    itemTypeDetail: '칭호',
    itemRarity: '레어',
    itemAvailableLevel: 1
  },
  [ids.fusionStone]: {
    itemId: ids.fusionStone,
    itemName: '합성 융합석',
    itemType: '융합석',
    itemAvailableLevel: 115
  },
  [ids.oath]: {
    itemId: ids.oath,
    itemName: '합성 서약',
    itemType: '서약',
    itemTypeDetail: '서약',
    itemRarity: '태초',
    itemAvailableLevel: 115,
    setItemId,
    setItemName: '합성 세트'
  },
  [ids.craftedOath]: {
    itemId: ids.craftedOath,
    itemName: '합성 서약 결정',
    itemType: '서약 결정',
    itemTypeDetail: '서약 결정',
    itemRarity: '에픽',
    itemAvailableLevel: 115,
    setItemId,
    setItemName: '합성 세트'
  }
}
const emptyEntry = (itemId: string): ItemDictionaryEntry => ({
  itemId,
  availableLevel: null,
  itemType: null,
  itemTypeDetail: null,
  itemRarity: null,
  setItemId: null,
  setItemName: null
})

const character = { serverId: 'siroco', characterId: 'item-dictionary-fixture' }
const now = new Date('2026-11-18T12:00:00+09:00')
const syncedState: TimelineSyncState = {
  syncedUntil: new Date('2026-11-18T10:00:00+09:00'),
  lastSucceededAt: new Date('2026-11-18T10:00:00+09:00')
}

function acquisition(code: number, itemId: string, itemRarity: string): TimelineItemInput {
  return {
    code,
    occurredAt: new Date('2026-11-18T11:00:00+09:00'),
    name: '아이템 획득',
    itemId,
    itemName: '합성 아이템',
    itemRarity,
    data: { itemId, itemRarity }
  }
}

// 저장 함수와 같은 결과를 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryTimeline() {
  const replaced: TimelineRange[] = []
  let successes = 0
  const store: TimelineSyncRepository = {
    readSyncState: async () => syncedState,
    replaceRange: async (_character, range) => {
      replaced.push(range)
    },
    recordActive: async () => undefined,
    recordSuccess: async () => {
      successes++
    },
    recordFailure: async () => assert.fail('동기화 실패가 기록되면 안 된다')
  }

  return { store, replaced, successes: () => successes }
}

function memoryDictionary(initial: readonly ItemDictionaryEntry[] = []) {
  const entries = new Map(initial.map((entry) => [entry.itemId, entry]))
  const repository: ItemDictionaryRepository = {
    readUnlistedItemIds: async (itemIds) => itemIds.filter((itemId) => !entries.has(itemId)),
    record: async (recorded) => {
      for (const entry of recorded) {
        entries.set(entry.itemId, entry)
      }
    }
  }

  return { repository, entries }
}

function neopleItems() {
  const requested: string[][] = []
  const fetchItemDetails: FetchItemDetails = async (itemIds) => {
    requested.push(itemIds)

    return new Map(
      itemIds.filter((itemId) => itemId in details).map((itemId) => [itemId, details[itemId]!])
    )
  }

  return { fetchItemDetails, requested }
}

function syncService(
  timeline: TimelineSyncRepository,
  inputs: TimelineInputs,
  dictionary: ItemDictionaryService
) {
  return new TimelineSyncService(
    timeline,
    async () => inputs,
    dictionary,
    () => now
  )
}

const unexpectedFailure = () => assert.fail('사전 채우기 실패가 보고되면 안 된다')

test(SAVES_UNLISTED_ITEMS, async () => {
  const timeline = memoryTimeline()
  const dictionary = memoryDictionary([
    { ...emptyEntry(ids.fusionStone), availableLevel: 115, itemType: '융합석' }
  ])
  const neople = neopleItems()
  const inputs: TimelineInputs = {
    events: [],
    items: [
      acquisition(505, ids.weapon, '태초'),
      acquisition(513, ids.weapon, '태초'),
      acquisition(502, ids.armor, '에픽'),
      acquisition(504, ids.title, '레전더리'),
      acquisition(505, ids.fusionStone, '에픽'),
      acquisition(505, ids.rare, '레어'),
      acquisition(550, ids.oath, '태초'),
      acquisition(554, ids.craftedOath, '레어')
    ]
  }

  await syncService(
    timeline.store,
    inputs,
    new ItemDictionaryService(dictionary.repository, neople.fetchItemDetails)
  ).sync(character, unexpectedFailure)

  assert.deepEqual(
    neople.requested.flat().toSorted(),
    [ids.weapon, ids.armor, ids.title, ids.oath, ids.craftedOath].toSorted()
  )
  assert.deepEqual(dictionary.entries.get(ids.weapon), {
    itemId: ids.weapon,
    availableLevel: 115,
    itemType: '무기',
    itemTypeDetail: '대검',
    itemRarity: '태초',
    setItemId: null,
    setItemName: null
  })
  assert.deepEqual(dictionary.entries.get(ids.armor), {
    itemId: ids.armor,
    availableLevel: 115,
    itemType: '방어구',
    itemTypeDetail: '상의',
    itemRarity: '에픽',
    setItemId,
    setItemName: '합성 세트'
  })
  assert.deepEqual(dictionary.entries.get(ids.craftedOath), {
    itemId: ids.craftedOath,
    availableLevel: 115,
    itemType: '서약 결정',
    itemTypeDetail: '서약 결정',
    itemRarity: '에픽',
    setItemId,
    setItemName: '합성 세트'
  })
  assert.equal(dictionary.entries.has(ids.rare), false)
})

test(SKIPS_LISTED_ITEMS, async () => {
  const timeline = memoryTimeline()
  const dictionary = memoryDictionary([
    { ...emptyEntry(ids.weapon), availableLevel: 115, itemType: '무기', itemRarity: '태초' }
  ])
  const neople = neopleItems()

  await syncService(
    timeline.store,
    { events: [], items: [acquisition(505, ids.weapon, '태초')] },
    new ItemDictionaryService(dictionary.repository, neople.fetchItemDetails)
  ).sync(character, unexpectedFailure)

  assert.deepEqual(neople.requested, [])
  assert.equal(timeline.successes(), 1)
})

test(KEEPS_MISSING_ROWS, async () => {
  const dictionary = memoryDictionary()
  const neople = neopleItems()
  const service = new ItemDictionaryService(dictionary.repository, neople.fetchItemDetails)
  const inputs: TimelineInputs = { events: [], items: [acquisition(505, ids.missing, '에픽')] }

  for (let run = 0; run < 2; run++) {
    await syncService(memoryTimeline().store, inputs, service).sync(character, unexpectedFailure)
  }

  assert.deepEqual(neople.requested, [[ids.missing]])
  assert.deepEqual(dictionary.entries.get(ids.missing), emptyEntry(ids.missing))
})

test(SYNC_SURVIVES_FAILURE, async () => {
  const timeline = memoryTimeline()
  const dictionary = memoryDictionary()
  let reports = 0
  const failingItems: FetchItemDetails = async () => {
    throw new Error('Catalog lookup failed')
  }

  await syncService(
    timeline.store,
    { events: [], items: [acquisition(505, ids.weapon, '태초')] },
    new ItemDictionaryService(dictionary.repository, failingItems)
  ).sync(character, () => {
    reports++
  })

  assert.equal(timeline.replaced.length, 1)
  assert.equal(timeline.successes(), 1)
  assert.equal(reports, 1)
  assert.equal(dictionary.entries.size, 0)
})
