import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuctionPriceEntry } from '@dfragon/database'
import { createNeopleClientForTest, NeopleRequestFailure } from '@dfragon/neople'
import { AuctionPriceService } from '../src/application/auction-prices/index.js'
import {
  createNeopleItemSearch,
  createNeopleLowestLevelListing,
  createNeopleLowestListing
} from '../src/infrastructure/neople/index.js'

const SAVES_LOWEST_EXACT_LISTING =
  '이름이 정확히 같은 매물 가운데 가장 낮은 unitPrice와 그 매물의 itemId, itemRarity를 저장하고, 마법부여 카드는 매물이 없으면 앞부분 검색 없이 가격을 비우고 아이템 검색의 itemId, 등급을 저장한다'
const EXCHANGED_SKIPS_AUCTION =
  '재화로 교환하는 아이템은 경매장을 부르지 않고 아이템 검색에서 이름이 같은 아이템의 itemId, 등급만 저장하며, 검색에도 없으면 모두 비운다'
const SAVES_LOWEST_LEVEL_LISTING =
  '이름이 정확히 같은 매물이 있으면 그 매물을 저장하고, 칭호, 크리쳐, 오라는 그 매물이 없을 때만 앞부분 검색에서 아이템 종류가 같은 `이름[숫자Lv]` 매물 가운데 가장 낮은 unitPrice와 그 매물의 itemId, itemRarity를 저장하고, 다른 꼬리표와 다른 종류는 받지 않는다'
const SAVES_MIDDLE_LEVEL_TAG_LISTING =
  '이름 전체의 앞부분 검색에 꼬리표 매물이 없으면 마지막 단어를 뺀 앞부분으로 다시 찾아, `이름[숫자Lv] 알`처럼 꼬리표가 중간에 낀 매물 가운데 꼬리표 하나를 뺀 이름이 같은 것의 최저가를 저장하고, 둘 다 없으면 아이템 검색으로 넘어간다'
const SAVES_CREATURE_EGG_LISTING =
  '크리쳐는 정확한 이름 매물이 없으면 앞부분 검색에서 `이름 알`, `이름의 알`과 꼬리표 없는 이름의 `이름[숫자Lv] 알` 크리쳐 매물 가운데 최저가를 저장하고, 꼬리표가 있는 이름은 같은 꼬리표의 알만, 크리쳐가 아닌 알과 칭호의 알은 받지 않는다'
const KEEPS_SAVED_PRICES_ON_FAILURE =
  '세 번째 이름의 조회가 실패하면 앞의 두 이름은 저장돼 있고 실패를 그대로 던진다'

// 합성 경매장 응답이다. 아이템 이름은 지금은 지운 마법부여 등급표에 있던 카드 이름이고, itemId와 가격은 지어냈다.
const names = {
  first: '거짓의 베리디쿠스 카드',
  comma: '허망한 맹신, 호스디그 카드',
  unlisted: '광포의 마흐나발 카드'
}
// 레벨 꼬리표가 붙어야만 경매장에 오르는 칭호, 크리쳐, 오라와 정확한 이름으로 오르는 칭호를 흉내 낸 지어낸 이름이다.
const leveledTitle = '합성 칭호 플래티넘'
const leveledAura = '합성 오라'
const leveledCreature = '합성 크리쳐'
const exactTitle = '합성 칭호'
// 꼬리표가 마지막 단어 앞에 끼는 크리쳐 알을 흉내 낸 지어낸 이름이다.
const platinumEgg = '합성 재단사 플래티넘 알'
const plainEgg = '합성 응원단 알'
const unlistedEgg = '합성 빈 알'
// 경매장에 알로만 오르는 크리쳐 본체와 알 매물만 있는 칭호를 흉내 낸 지어낸 이름이다.
const eggCreature = '합성 펭귄'
const leveledEggCreature = '합성 거북'
const taggedCreature = '합성 여우[80Lv]'
const possessiveEggCreature = '합성 고래'
const eggTitle = '합성 표식'
const checkedAt = new Date('2026-11-26T12:00:00+09:00')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function auctionNeople(
  respond: (itemName: string, wordType: string) => Response,
  respondSearch: (itemName: string) => Response = () => jsonResponse({ rows: [] })
) {
  const requested: string[] = []
  const frontRequested: string[] = []
  const searched: string[] = []
  const neople = createNeopleClientForTest('synthetic-auction-key', {
    fetch: async (request) => {
      const url = new URL(request.url)
      const itemName = url.searchParams.get('itemName') ?? ''

      if (url.pathname === '/df/items') {
        searched.push(itemName)

        return respondSearch(itemName)
      }

      const wordType = url.searchParams.get('wordType') ?? ''

      if (wordType === 'front') {
        frontRequested.push(itemName)
      } else {
        requested.push(itemName)
      }

      return respond(itemName, wordType)
    }
  })

  return { neople, requested, frontRequested, searched }
}

function priceService(
  neople: ReturnType<typeof auctionNeople>['neople'],
  repository: ReturnType<typeof memoryPrices>['repository']
) {
  return new AuctionPriceService(
    repository,
    createNeopleLowestListing(neople),
    createNeopleLowestLevelListing(neople),
    createNeopleItemSearch(neople),
    () => checkedAt
  )
}

function listed(itemName: string, categories: string[] = ['WEAPON']) {
  return { itemName, exchanged: false, categories }
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
  const { neople, requested, frontRequested, searched } = auctionNeople(
    (itemName) => jsonResponse({ rows: rows[itemName] ?? [] }),
    (itemName) =>
      jsonResponse({ rows: [{ itemId: 'f'.repeat(32), itemName, itemRarity: '유니크' }] })
  )
  const { saved, repository } = memoryPrices()
  const service = priceService(neople, repository)
  const progress: [number, number][] = []

  const checked = await service.refresh(
    Object.values(names).map((itemName) => listed(itemName)),
    (done, total) => progress.push([done, total])
  )

  assert.equal(checked, 3)
  assert.deepEqual(requested, Object.values(names))
  assert.deepEqual(frontRequested, [])
  assert.deepEqual(searched, [names.unlisted])
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
    itemId: 'f'.repeat(32),
    itemRarity: '유니크',
    unitPrice: null,
    checkedAt
  })
})

test(EXCHANGED_SKIPS_AUCTION, async () => {
  const exchanged = { itemName: names.first, exchanged: true, categories: ['TITLE'] }
  const unknown = { itemName: names.comma, exchanged: true, categories: ['TITLE'] }
  const { neople, requested, frontRequested, searched } = auctionNeople(
    () => jsonResponse({ rows: [] }),
    (itemName) => {
      if (itemName !== names.first) {
        return jsonResponse({ rows: [] })
      }

      return jsonResponse({
        rows: [
          { itemId: 'c'.repeat(32), itemName: `${names.first} 상자`, itemRarity: '에픽' },
          { itemId: 'a'.repeat(32), itemName: names.first, itemRarity: '유니크' }
        ]
      })
    }
  )
  const { saved, repository } = memoryPrices()

  await priceService(neople, repository).refresh([exchanged, unknown])

  assert.deepEqual(requested, [])
  assert.deepEqual(frontRequested, [])
  assert.deepEqual(searched, [names.first, names.comma])
  assert.deepEqual(saved.get(names.first), {
    itemName: names.first,
    itemId: 'a'.repeat(32),
    itemRarity: '유니크',
    unitPrice: null,
    checkedAt
  })
  assert.deepEqual(saved.get(names.comma), {
    itemName: names.comma,
    itemId: null,
    itemRarity: null,
    unitPrice: null,
    checkedAt
  })
})

test(SAVES_LOWEST_LEVEL_LISTING, async () => {
  const listing = (id: string, itemName: string, itemTypeDetail: string, unitPrice: number) => ({
    itemId: id.repeat(32),
    itemName,
    itemRarity: '레어',
    itemTypeDetail,
    unitPrice
  })

  const frontRows: Record<string, unknown[]> = {
    [leveledTitle]: [
      listing('a', `${leveledTitle}[45Lv]`, '칭호', 30_000),
      listing('b', `${leveledTitle}[95Lv]`, '칭호', 27_000),
      listing('c', `${leveledTitle}[100Lv]`, '칭호', 29_000),
      listing('d', `${leveledTitle} 상자`, '칭호', 100),
      listing('e', `${leveledTitle}[95Lv] 상자`, '칭호', 200),
      listing('f', `${leveledTitle}[Lv]`, '칭호', 300),
      listing('1', `${leveledTitle} 2[95Lv]`, '칭호', 400),
      listing('2', `${leveledTitle}[90Lv]`, '오라', 500),
      { itemId: '3'.repeat(32), itemName: `${leveledTitle}[85Lv]`, unitPrice: 600 }
    ],
    [leveledCreature]: [
      listing('6', `${leveledCreature}[80Lv]`, '오라', 900),
      listing('7', `${leveledCreature}[80Lv]`, '크리쳐', 9_000)
    ],
    [leveledAura]: [
      listing('4', `${leveledAura}[90Lv]`, '칭호', 700),
      listing('5', `${leveledAura}[90Lv]`, '오라', 8_000)
    ]
  }

  const { neople, requested, frontRequested, searched } = auctionNeople((itemName, wordType) => {
    if (wordType === 'front') {
      return jsonResponse({ rows: frontRows[itemName] ?? [] })
    }

    if (itemName === exactTitle) {
      return jsonResponse({ rows: [listing('8', exactTitle, '칭호', 50_000)] })
    }

    return jsonResponse({ rows: [] })
  })

  const { saved, repository } = memoryPrices()

  await priceService(neople, repository).refresh([
    listed(leveledTitle, ['TITLE']),
    listed(leveledCreature, ['CREATURE']),
    listed(leveledAura, ['AURA']),
    listed(exactTitle, ['TITLE'])
  ])

  assert.deepEqual(requested, [leveledTitle, leveledCreature, leveledAura, exactTitle])
  assert.deepEqual(frontRequested, [leveledTitle, leveledCreature, leveledAura])
  assert.deepEqual(searched, [])
  assert.deepEqual(saved.get(leveledTitle), {
    itemName: leveledTitle,
    itemId: 'b'.repeat(32),
    itemRarity: '레어',
    unitPrice: 27_000,
    checkedAt
  })
  assert.deepEqual(saved.get(leveledCreature), {
    itemName: leveledCreature,
    itemId: '7'.repeat(32),
    itemRarity: '레어',
    unitPrice: 9_000,
    checkedAt
  })
  assert.deepEqual(saved.get(exactTitle), {
    itemName: exactTitle,
    itemId: '8'.repeat(32),
    itemRarity: '레어',
    unitPrice: 50_000,
    checkedAt
  })
  assert.deepEqual(saved.get(leveledAura), {
    itemName: leveledAura,
    itemId: '5'.repeat(32),
    itemRarity: '레어',
    unitPrice: 8_000,
    checkedAt
  })
})

test(SAVES_MIDDLE_LEVEL_TAG_LISTING, async () => {
  const listing = (id: string, itemName: string, unitPrice: number) => ({
    itemId: id.repeat(32),
    itemName,
    itemRarity: '레어',
    itemTypeDetail: '크리쳐',
    unitPrice
  })

  const frontRows: Record<string, unknown[]> = {
    '합성 재단사 플래티넘': [
      listing('a', '합성 재단사 플래티넘[45Lv] 알', 12_000),
      listing('b', '합성 재단사 플래티넘[95Lv] 알', 11_000),
      listing('c', '합성 재단사 플래티넘 알', 50),
      listing('d', '합성 재단사 플래티넘[95Lv] 상자', 100),
      listing('e', '합성 재단사 플래티넘[95Lv] 알 상자', 200),
      listing('f', '합성 재단사 플래티넘[95Lv] 알[95Lv]', 300)
    ],
    '합성 응원단': [
      listing('1', '합성 응원단 2[45Lv] 알', 400),
      listing('2', '합성 응원단[45Lv] 알', 6_000)
    ]
  }

  const { neople, frontRequested, searched } = auctionNeople((itemName, wordType) => {
    if (wordType === 'front') {
      return jsonResponse({ rows: frontRows[itemName] ?? [] })
    }

    return jsonResponse({ rows: [] })
  })

  const { saved, repository } = memoryPrices()

  await priceService(neople, repository).refresh([
    listed(platinumEgg, ['CREATURE']),
    listed(plainEgg, ['CREATURE']),
    listed(unlistedEgg, ['CREATURE'])
  ])

  assert.deepEqual(frontRequested, [
    platinumEgg,
    '합성 재단사 플래티넘',
    plainEgg,
    '합성 응원단',
    unlistedEgg,
    '합성 빈'
  ])
  assert.deepEqual(searched, [unlistedEgg])
  assert.deepEqual(saved.get(platinumEgg), {
    itemName: platinumEgg,
    itemId: 'b'.repeat(32),
    itemRarity: '레어',
    unitPrice: 11_000,
    checkedAt
  })
  assert.deepEqual(saved.get(plainEgg), {
    itemName: plainEgg,
    itemId: '2'.repeat(32),
    itemRarity: '레어',
    unitPrice: 6_000,
    checkedAt
  })
  assert.deepEqual(saved.get(unlistedEgg), {
    itemName: unlistedEgg,
    itemId: null,
    itemRarity: null,
    unitPrice: null,
    checkedAt
  })
})

test(SAVES_CREATURE_EGG_LISTING, async () => {
  const listing = (id: string, itemName: string, itemTypeDetail: string, unitPrice: number) => {
    const itemId = id.repeat(32)
    const itemRarity = id === 'a' ? '에픽' : '레어'

    return { itemId, itemName, itemRarity, itemTypeDetail, unitPrice }
  }

  const frontRows: Record<string, unknown[]> = {
    [eggCreature]: [
      listing('a', `${eggCreature} 알`, '크리쳐', 20_000),
      listing('b', `${eggCreature} 플래티넘[45Lv] 알`, '크리쳐', 100),
      listing('c', `${eggCreature} 상자`, '크리쳐', 200),
      listing('d', `${eggCreature} 알`, '칭호', 300)
    ],
    [leveledEggCreature]: [
      listing('e', `${leveledEggCreature}[30Lv] 알`, '크리쳐', 15_000),
      listing('f', `${leveledEggCreature}[75Lv] 알`, '크리쳐', 13_000)
    ],
    [taggedCreature]: [
      listing('1', `${taggedCreature} 알`, '크리쳐', 40_000),
      listing('2', '합성 여우[30Lv] 알', '크리쳐', 1_000)
    ],
    [possessiveEggCreature]: [listing('3', `${possessiveEggCreature}의 알`, '크리쳐', 7_000)],
    [eggTitle]: [listing('4', `${eggTitle} 알`, '칭호', 500)]
  }

  const { neople, searched } = auctionNeople((itemName, wordType) => {
    if (wordType === 'front') {
      return jsonResponse({ rows: frontRows[itemName] ?? [] })
    }

    return jsonResponse({ rows: [] })
  })

  const { saved, repository } = memoryPrices()

  await priceService(neople, repository).refresh([
    listed(eggCreature, ['CREATURE']),
    listed(leveledEggCreature, ['CREATURE']),
    listed(taggedCreature, ['CREATURE']),
    listed(possessiveEggCreature, ['CREATURE']),
    listed(eggTitle, ['TITLE'])
  ])

  assert.deepEqual(searched, [eggTitle])
  assert.deepEqual(saved.get(eggCreature), {
    itemName: eggCreature,
    itemId: 'a'.repeat(32),
    itemRarity: '에픽',
    unitPrice: 20_000,
    checkedAt
  })
  assert.deepEqual(saved.get(leveledEggCreature), {
    itemName: leveledEggCreature,
    itemId: 'f'.repeat(32),
    itemRarity: '레어',
    unitPrice: 13_000,
    checkedAt
  })
  assert.deepEqual(saved.get(taggedCreature), {
    itemName: taggedCreature,
    itemId: '1'.repeat(32),
    itemRarity: '레어',
    unitPrice: 40_000,
    checkedAt
  })
  assert.deepEqual(saved.get(possessiveEggCreature), {
    itemName: possessiveEggCreature,
    itemId: '3'.repeat(32),
    itemRarity: '레어',
    unitPrice: 7_000,
    checkedAt
  })
  assert.deepEqual(saved.get(eggTitle), {
    itemName: eggTitle,
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
  const service = priceService(neople, repository)

  await assert.rejects(
    service.refresh(itemNames.map((itemName) => listed(itemName))),
    NeopleRequestFailure
  )
  assert.deepEqual([...saved.keys()], [names.first, names.comma])
})
