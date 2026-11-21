import assert from 'node:assert/strict'
import test from 'node:test'
import type { ItemDictionaryEntry } from '@dfragon/database'
import { ItemDictionaryService } from '@dfragon/server-core/application/item-dictionary/index.js'
import type { FetchItemDetails } from '@dfragon/server-core/application/item-dictionary/ports.js'
import type { ItemDictionaryRepository } from '@dfragon/server-core/application/item-dictionary/repository.js'
import { createItemDictionaryFillJob } from '../src/application/item-dictionary/index.js'
import type { AcquisitionItemRepository } from '../src/application/item-dictionary/repository.js'

// 합성 itemId 17개다. 하나는 사전에 있고, 남은 16개로 한 번에 15개씩 묻는 경계를 넘긴다. DB 읽기와 저장은 fake이며 SQL은
// @dfragon/database의 DB 통합 테스트가 확인한다.
const acquiredItemIds = Array.from({ length: 17 }, (_, index) => index.toString(17).repeat(32))
const listedItemId = acquiredItemIds[0]!

function memoryStores() {
  const entries = new Map<string, ItemDictionaryEntry>([
    [
      listedItemId,
      {
        itemId: listedItemId,
        availableLevel: 115,
        itemType: '무기',
        itemTypeDetail: '대검',
        itemRarity: '태초',
        setItemId: null,
        setItemName: null
      }
    ]
  ])
  const acquisitions: AcquisitionItemRepository = {
    readUnlistedItemIds: async () => acquiredItemIds.filter((itemId) => !entries.has(itemId))
  }
  const dictionary: ItemDictionaryRepository = {
    readUnlistedItemIds: async (itemIds) => itemIds.filter((itemId) => !entries.has(itemId)),
    record: async (recorded) => {
      for (const entry of recorded) {
        entries.set(entry.itemId, entry)
      }
    }
  }

  return { entries, acquisitions, dictionary }
}

test('아이템 사전 채우기는 사전에 없는 itemId만 조회하고, 바로 다시 실행하면 조회하지 않는다', async () => {
  const stores = memoryStores()
  const requested: string[][] = []
  const fetchItemDetails: FetchItemDetails = async (itemIds) => {
    requested.push(itemIds)

    return new Map(
      itemIds.map((itemId) => [itemId, { itemId, itemType: '방어구', itemAvailableLevel: 115 }])
    )
  }
  const job = createItemDictionaryFillJob(
    stores.acquisitions,
    new ItemDictionaryService(stores.dictionary, fetchItemDetails)
  )
  const progress: [number, number | undefined][] = []
  const context = { reportProgress: (done: number, total?: number) => progress.push([done, total]) }

  assert.deepEqual(await job.run({}, context), { fetched: 16 })
  assert.deepEqual(requested.flat().toSorted(), acquiredItemIds.slice(1).toSorted())
  assert.deepEqual(
    requested.map((batch) => batch.length),
    [15, 1]
  )
  assert.deepEqual(progress.at(-1), [16, 16])
  assert.equal(stores.entries.size, 17)

  requested.length = 0
  assert.deepEqual(await job.run({}, context), { fetched: 0 })
  assert.deepEqual(requested, [])
})

test('아이템 사전 채우기 job은 매시간 정각에 돈다', () => {
  const stores = memoryStores()
  const job = createItemDictionaryFillJob(
    stores.acquisitions,
    new ItemDictionaryService(stores.dictionary, async () => new Map())
  )

  assert.equal(job.schedule, '0 * * * *')
})
