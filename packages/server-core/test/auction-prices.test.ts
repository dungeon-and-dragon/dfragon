import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuctionPriceEntry } from '@dfragon/database'
import { createNeopleClientForTest, NeopleRequestFailure } from '@dfragon/neople'
import { AuctionPriceService } from '../src/application/auction-prices/index.js'
import { createNeopleLowestListing } from '../src/infrastructure/neople/index.js'

const SAVES_LOWEST_EXACT_LISTING =
  '이름이 정확히 같은 매물 가운데 가장 낮은 unitPrice와 그 매물의 itemId, itemRarity를 저장하고, 매물이 없으면 가격을 비운다'
const KEEPS_SAVED_PRICES_ON_FAILURE =
  '세 번째 이름의 조회가 실패하면 앞의 두 이름은 저장돼 있고 실패를 그대로 던진다'

// 합성 경매장 응답이다. 아이템 이름은 저장소의 마법부여 등급표에 있는 카드 이름이고, itemId와 가격은 지어냈다.
const names = {
  first: '거짓의 베리디쿠스 카드',
  comma: '허망한 맹신, 호스디그 카드',
  unlisted: '광포의 마흐나발 카드'
}
const checkedAt = new Date('2026-11-26T12:00:00+09:00')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function auctionNeople(respond: (itemName: string) => Response) {
  const requested: string[] = []
  const neople = createNeopleClientForTest('synthetic-auction-key', {
    fetch: async (request) => {
      const itemName = new URL(request.url).searchParams.get('itemName') ?? ''
      requested.push(itemName)

      return respond(itemName)
    }
  })

  return { neople, requested }
}

function memoryPrices() {
  const saved = new Map<string, AuctionPriceEntry>()

  return {
    saved,
    repository: {
      record: async (entry: AuctionPriceEntry) => {
        saved.set(entry.itemName, entry)
      }
    }
  }
}

test(SAVES_LOWEST_EXACT_LISTING, async () => {
  const rows: Record<string, unknown[]> = {
    [names.first]: [
      { itemId: 'a'.repeat(32), itemName: names.first, itemRarity: '유니크', unitPrice: 9_000 },
      { itemId: 'b'.repeat(32), itemName: names.first, itemRarity: '레전더리', unitPrice: 7_500 },
      {
        itemId: 'c'.repeat(32),
        itemName: `${names.first} 상자`,
        itemRarity: '에픽',
        unitPrice: 100
      }
    ],
    [names.comma]: [
      { itemId: 'd'.repeat(32), itemName: names.comma, itemRarity: '유니크', unitPrice: 42_000 }
    ],
    [names.unlisted]: [
      {
        itemId: 'e'.repeat(32),
        itemName: `${names.unlisted} 상자`,
        itemRarity: '에픽',
        unitPrice: 300
      }
    ]
  }
  const { neople, requested } = auctionNeople((itemName) =>
    jsonResponse({ rows: rows[itemName] ?? [] })
  )
  const { saved, repository } = memoryPrices()
  const service = new AuctionPriceService(
    repository,
    createNeopleLowestListing(neople),
    () => checkedAt
  )
  const progress: [number, number][] = []

  const checked = await service.refresh(Object.values(names), (done, total) =>
    progress.push([done, total])
  )

  assert.equal(checked, 3)
  assert.deepEqual(requested, Object.values(names))
  assert.deepEqual(progress, [
    [1, 3],
    [2, 3],
    [3, 3]
  ])
  assert.deepEqual(saved.get(names.first), {
    itemName: names.first,
    itemId: 'b'.repeat(32),
    itemRarity: '레전더리',
    unitPrice: 7_500,
    checkedAt
  })
  assert.deepEqual(saved.get(names.comma), {
    itemName: names.comma,
    itemId: 'd'.repeat(32),
    itemRarity: '유니크',
    unitPrice: 42_000,
    checkedAt
  })
  assert.deepEqual(saved.get(names.unlisted), {
    itemName: names.unlisted,
    itemId: null,
    itemRarity: null,
    unitPrice: null,
    checkedAt
  })
})

test(KEEPS_SAVED_PRICES_ON_FAILURE, async () => {
  const itemNames = [names.first, names.comma, names.unlisted]
  const { neople } = auctionNeople((itemName) => {
    if (itemName === names.unlisted) {
      return jsonResponse({ error: { code: 'API002' } }, 503)
    }

    return jsonResponse({
      rows: [{ itemId: 'a'.repeat(32), itemName, itemRarity: '유니크', unitPrice: 1_000 }]
    })
  })
  const { saved, repository } = memoryPrices()
  const service = new AuctionPriceService(
    repository,
    createNeopleLowestListing(neople),
    () => checkedAt
  )

  await assert.rejects(service.refresh(itemNames), NeopleRequestFailure)
  assert.deepEqual([...saved.keys()], [names.first, names.comma])
})
