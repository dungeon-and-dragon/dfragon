import assert from 'node:assert/strict'
import test from 'node:test'
import type { LabItemPriceRow } from '@dfragon/database'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { FetchCatalog } from '@dfragon/server-core/application/character-catalog/ports.js'
import type { LabItemRepository } from '../src/application/lab-items/repository.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

const unusedProvider = async () =>
  assert.fail('실험실 아이템 경로는 카드 상세 말고 Neople을 부르면 안 된다')
const noCatalog: FetchCatalog = async () => new Map()

const CHECKED_AT = '2026-11-26T00:00:00.000Z'

// 아이템 이름은 모두 지어낸 이름이다.
function row(
  category: string,
  role: string,
  tier: string,
  itemName: string,
  unitPrice: number | null,
  checked = true
): LabItemPriceRow {
  if (!checked) {
    return {
      category,
      role,
      tier,
      itemName,
      itemId: null,
      itemRarity: null,
      unitPrice: null,
      checkedAt: null,
      cost: null,
      detail: null
    }
  }

  const listed = unitPrice !== null
  const itemId = listed ? 'synthetic-item' : null
  const itemRarity = listed ? '레전더리' : null

  return {
    category,
    role,
    tier,
    itemName,
    itemId,
    itemRarity,
    unitPrice,
    checkedAt: new Date(CHECKED_AT),
    cost: null,
    detail: null
  }
}

async function startApi(
  t: test.TestContext,
  rows: LabItemPriceRow[],
  readCurrencyIcon: LabItemRepository['readCurrencyIcon'] = async () => null,
  readItemIcon: LabItemRepository['readItemIcon'] = async () => null,
  fetchCatalog: FetchCatalog = noCatalog
) {
  const labItems: LabItemRepository = {
    readLabItemPrices: async () => rows,
    readCurrencyIcon,
    readItemIcon
  }
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: { fetchDetails: unusedProvider, catalog: new CatalogService(fetchCatalog) },
    todayGrade: { fetchShopGrade: unusedProvider },
    labItems,
    writeAccessLog: () => undefined
  })

  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string) => fetch(`${origin}${path}`)
}

async function requestLabItems(
  t: test.TestContext,
  rows: LabItemPriceRow[],
  fetchCatalog: FetchCatalog = noCatalog
) {
  const request = await startApi(t, rows, undefined, undefined, fetchCatalog)

  return request('/lab/items')
}

test('묶음은 마법부여 부위, 딜러와 버퍼, 종결과 준종결 순서이고 칭호 묶음은 뒤에 role all로 온다', async (t) => {
  const response = await requestLabItems(t, [
    row('TITLE', 'all', '종결', '합성 칭호 A', 500),
    row('JACKET', 'dealer', '종결', '합성 카드 D', 400),
    row('WEAPON', 'buffer', '종결', '합성 카드 C', 300),
    row('WEAPON', 'dealer', '준종결', '합성 카드 B', 200),
    row('WEAPON', 'dealer', '종결', '합성 카드 A', 100)
  ])

  assert.equal(response.status, 200)
  const { groups } = (await response.json()) as {
    groups: { category: string; role: string; tier: string }[]
  }

  assert.deepEqual(
    groups.map(({ category, role, tier }) => [category, role, tier]),
    [
      ['WEAPON', 'dealer', '종결'],
      ['WEAPON', 'dealer', '준종결'],
      ['WEAPON', 'buffer', '종결'],
      ['JACKET', 'dealer', '종결'],
      ['TITLE', 'all', '종결']
    ]
  )
})

test('묶음 안은 가격이 낮은 순이고, 가격이 없는 아이템은 뒤에 이름순이며 가격 행이 없으면 가격 열이 모두 null이다', async (t) => {
  const response = await requestLabItems(t, [
    row('WEAPON', 'dealer', '종결', '합성 카드 다', null),
    row('WEAPON', 'dealer', '종결', '합성 카드 가', null, false),
    row('WEAPON', 'dealer', '종결', '합성 카드 비싼', 3_000_000_000),
    row('WEAPON', 'dealer', '종결', '합성 카드 싼', 900),
    row('WEAPON', 'dealer', '종결', '합성 카드 중간', 10_000),
    row('TITLE', 'all', '종결', '합성 칭호 A', null, false)
  ])

  assert.deepEqual(await response.json(), {
    groups: [
      {
        category: 'WEAPON',
        role: 'dealer',
        tier: '종결',
        items: [
          {
            itemName: '합성 카드 싼',
            itemId: 'synthetic-item',
            itemRarity: '레전더리',
            iconPath: null,
            description: null,
            tooltip: null,
            fame: null,
            unitPrice: 900,
            checkedAt: CHECKED_AT,
            cost: null
          },
          {
            itemName: '합성 카드 중간',
            itemId: 'synthetic-item',
            itemRarity: '레전더리',
            iconPath: null,
            description: null,
            tooltip: null,
            fame: null,
            unitPrice: 10_000,
            checkedAt: CHECKED_AT,
            cost: null
          },
          {
            itemName: '합성 카드 비싼',
            itemId: 'synthetic-item',
            itemRarity: '레전더리',
            iconPath: null,
            description: null,
            tooltip: null,
            fame: null,
            unitPrice: 3_000_000_000,
            checkedAt: CHECKED_AT,
            cost: null
          },
          {
            itemName: '합성 카드 가',
            itemId: null,
            itemRarity: null,
            iconPath: null,
            description: null,
            tooltip: null,
            fame: null,
            unitPrice: null,
            checkedAt: null,
            cost: null
          },
          {
            itemName: '합성 카드 다',
            itemId: null,
            itemRarity: null,
            iconPath: null,
            description: null,
            tooltip: null,
            fame: null,
            unitPrice: null,
            checkedAt: CHECKED_AT,
            cost: null
          }
        ]
      },
      {
        category: 'TITLE',
        role: 'all',
        tier: '종결',
        items: [
          {
            itemName: '합성 칭호 A',
            itemId: null,
            itemRarity: null,
            iconPath: null,
            description: null,
            tooltip: null,
            fame: null,
            unitPrice: null,
            checkedAt: null,
            cost: null
          }
        ]
      }
    ]
  })
})

test('같은 이름이 두 묶음에 있으면 묶음마다 따로 나온다', async (t) => {
  const response = await requestLabItems(t, [
    row('WEAPON', 'dealer', '종결', '합성 카드 A', 1200),
    row('WEAPON', 'buffer', '종결', '합성 카드 A', 1200)
  ])

  const { groups } = (await response.json()) as {
    groups: { role: string; items: { itemName: string; unitPrice: number | null }[] }[]
  }

  assert.deepEqual(
    groups.map(({ role, items }) => [
      role,
      items.map(({ itemName, unitPrice }) => [itemName, unitPrice])
    ]),
    [
      ['dealer', [['합성 카드 A', 1200]]],
      ['buffer', [['합성 카드 A', 1200]]]
    ]
  )
})

test('고른 아이템이 없으면 200과 빈 groups로 답한다', async (t) => {
  const response = await requestLabItems(t, [])

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { groups: [] })
})

test('재화 비용을 붙인 아이템은 경매장 가격 없이 재화 이름, 설명, 개수와 바꾼 시각이 든 아이콘 경로를 낸다', async (t) => {
  const currencyUpdatedAt = new Date('2026-11-27T01:02:03.004Z')
  const exchanged: LabItemPriceRow = {
    ...row('WEAPON', 'dealer', '준종결', '합성 보주', 5_000),
    itemRarity: '유니크',
    cost: {
      currencyId: 7,
      currencyName: '합성 재화',
      currencyDescription: '합성 설명',
      currencyUpdatedAt,
      count: 5
    }
  }

  const response = await requestLabItems(t, [exchanged])

  assert.deepEqual(await response.json(), {
    groups: [
      {
        category: 'WEAPON',
        role: 'dealer',
        tier: '준종결',
        items: [
          {
            itemName: '합성 보주',
            itemId: 'synthetic-item',
            itemRarity: '유니크',
            iconPath: null,
            description: null,
            tooltip: null,
            fame: null,
            unitPrice: null,
            checkedAt: CHECKED_AT,
            cost: {
              currencyName: '합성 재화',
              description: '합성 설명',
              count: 5,
              iconPath: `/lab/currencies/7/icon?v=${currencyUpdatedAt.getTime()}`
            }
          }
        ]
      }
    ]
  })
})

test('재화 아이콘은 저장한 형식으로 오래 캐시하게 내고, 없는 재화와 잘못된 id는 404로 답한다', async (t) => {
  // 합성 바이트다.
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
  const requested: number[] = []
  const request = await startApi(t, [], async (id) => {
    requested.push(id)

    if (id !== 7) {
      return null
    }

    return { bytes, contentType: 'image/png' }
  })

  const icon = await request('/lab/currencies/7/icon?v=1')

  assert.equal(icon.status, 200)
  assert.equal(icon.headers.get('content-type'), 'image/png')
  assert.equal(icon.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.equal(icon.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(new Uint8Array(await icon.arrayBuffer()), bytes)
  assert.equal((await request('/lab/currencies/8/icon')).status, 404)
  assert.equal((await request('/lab/currencies/0/icon')).status, 404)
  assert.equal((await request('/lab/currencies/x/icon')).status, 404)
  assert.deepEqual(requested, [7, 8])
})

test('소유자가 넣은 등급, 설명, 아이콘은 Neople 등급보다 먼저 쓰고, 넣지 않은 값은 Neople 값을 쓴다', async (t) => {
  const iconUpdatedAt = new Date('2026-11-27T03:04:05.006Z')
  const itemName = '합성 상자 (보주, 선택)'
  const noTooltip = { itemTypeDetail: null, availableLevel: null, fame: null, card: null }
  const response = await requestLabItems(t, [
    {
      ...row('TITLE', 'all', '종결', itemName, null, false),
      detail: { description: '합성 설명', itemRarity: '태초', iconUpdatedAt, ...noTooltip }
    },
    {
      ...row('TITLE', 'all', '종결', '합성 칭호', 900),
      detail: { description: null, itemRarity: null, iconUpdatedAt: null, ...noTooltip }
    }
  ])

  const { groups } = (await response.json()) as {
    groups: { items: Record<string, unknown>[] }[]
  }
  const looks = groups[0]?.items.map(({ itemName, itemId, itemRarity, iconPath, description }) => ({
    itemName,
    itemId,
    itemRarity,
    iconPath,
    description
  }))
  const iconUrl = new URL(String(looks?.[1]?.iconPath), 'http://api.test')

  assert.deepEqual(looks, [
    {
      itemName: '합성 칭호',
      itemId: 'synthetic-item',
      itemRarity: '레전더리',
      iconPath: null,
      description: null
    },
    {
      itemName,
      itemId: null,
      itemRarity: '태초',
      iconPath: looks?.[1]?.iconPath,
      description: '합성 설명'
    }
  ])
  assert.equal(iconUrl.pathname, '/lab/item-icon')
  assert.equal(iconUrl.searchParams.get('itemName'), itemName)
  assert.equal(iconUrl.searchParams.get('v'), String(iconUpdatedAt.getTime()))
})

test('소유자가 넣은 tooltip 값은 아이템 상세와 같은 이름과 카드 모양으로 내고, 상세가 없는 아이템은 null로 낸다', async (t) => {
  const stages = [
    { upgrade: 0, status: [{ name: '힘', value: '90' }] },
    { upgrade: 1, status: [{ name: '힘', value: '100' }] }
  ]
  const response = await requestLabItems(t, [
    {
      ...row('TITLE', 'all', '종결', '합성 상자', null, false),
      detail: {
        description: null,
        itemRarity: null,
        iconUpdatedAt: null,
        itemTypeDetail: '합성 재료',
        availableLevel: 115,
        fame: 232,
        card: { slots: ['상의'], enchants: stages }
      }
    },
    {
      ...row('TITLE', 'all', '종결', '합성 칭호', null, false),
      detail: {
        description: '합성 설명',
        itemRarity: null,
        iconUpdatedAt: null,
        itemTypeDetail: null,
        availableLevel: null,
        fame: null,
        card: null
      }
    },
    row('TITLE', 'all', '종결', '합성 카드', null, false)
  ])

  const { groups } = (await response.json()) as {
    groups: { items: { itemName: string; tooltip: unknown }[] }[]
  }
  const tooltips = groups[0]?.items.map(({ itemName, tooltip }) => ({ itemName, tooltip }))

  assert.deepEqual(tooltips, [
    {
      itemName: '합성 상자',
      tooltip: {
        typeDetail: '합성 재료',
        availableLevel: 115,
        fame: 232,
        card: {
          slots: ['상의'],
          enchants: [
            { upgrade: 0, status: [{ name: '힘', value: '90' }], reinforceSkill: [] },
            { upgrade: 1, status: [{ name: '힘', value: '100' }], reinforceSkill: [] }
          ]
        }
      }
    },
    {
      itemName: '합성 칭호',
      tooltip: { typeDetail: null, availableLevel: null, fame: null, card: null }
    },
    { itemName: '합성 카드', tooltip: null }
  ])
})

test('아이템 아이콘은 이름으로 찾아 오래 캐시하게 내고, 없는 이름과 빠진 이름은 404로 답한다', async (t) => {
  // 합성 바이트다.
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9])
  const itemName = '합성 상자 (보주, 선택)'
  const requested: string[] = []
  const request = await startApi(t, [], undefined, async (name) => {
    requested.push(name)

    if (name !== itemName) {
      return null
    }

    return { bytes, contentType: 'image/png' }
  })

  const icon = await request(`/lab/item-icon?${new URLSearchParams({ itemName, v: '1' })}`)

  assert.equal(icon.status, 200)
  assert.equal(icon.headers.get('content-type'), 'image/png')
  assert.equal(icon.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.equal(icon.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(new Uint8Array(await icon.arrayBuffer()), bytes)
  assert.equal((await request('/lab/item-icon?itemName=%ED%95%A9%EC%84%B1')).status, 404)
  assert.equal((await request('/lab/item-icon')).status, 404)
  assert.deepEqual(requested, [itemName, '합성'])
})

test('등급표에 없는 벨트 버퍼 준종결 묶음도 아이템이 있으면 응답에 낸다', async (t) => {
  const response = await requestLabItems(t, [
    row('WAIST', 'buffer', '준종결', '합성 벨트 카드', 300)
  ])

  const { groups } = (await response.json()) as {
    groups: { category: string; role: string; tier: string; items: { itemName: string }[] }[]
  }

  assert.deepEqual(
    groups.map(({ category, role, tier, items }) => [
      category,
      role,
      tier,
      items.map(({ itemName }) => itemName)
    ]),
    [['WAIST', 'buffer', '준종결', ['합성 벨트 카드']]]
  )
})

test('배럭 묶음은 같은 부위와 역할에서 종결, 준종결 뒤에 온다', async (t) => {
  const response = await requestLabItems(t, [
    row('WEAPON', 'dealer', '배럭', '합성 배럭 카드', 100),
    row('TITLE', 'all', '배럭', '합성 배럭 칭호', 50),
    row('WEAPON', 'dealer', '준종결', '합성 카드 B', 200),
    row('WEAPON', 'dealer', '종결', '합성 카드 A', 300)
  ])

  const { groups } = (await response.json()) as {
    groups: { category: string; role: string; tier: string }[]
  }

  assert.deepEqual(
    groups.map(({ category, role, tier }) => [category, role, tier]),
    [
      ['WEAPON', 'dealer', '종결'],
      ['WEAPON', 'dealer', '준종결'],
      ['WEAPON', 'dealer', '배럭'],
      ['TITLE', 'all', '배럭']
    ]
  )
})

// Neople 카드 상세의 cardInfo 모양이고, 마지막 단계의 모험가 명성이 카드 명성이다.
function cardPayload(stageFames: number[]) {
  return {
    itemName: '합성 카드',
    cardInfo: {
      slots: [{ slotName: '무기' }],
      enchant: stageFames.map((fame, upgrade) => ({
        upgrade,
        status: [{ name: '모험가 명성', value: fame }]
      }))
    }
  }
}

function cardRow(itemName: string, itemId: string, unitPrice: number | null): LabItemPriceRow {
  return { ...row('WEAPON', 'dealer', '종결', itemName, unitPrice), itemId }
}

const fameOfCard: Readonly<Record<string, number[]>> = {
  'card-high': [200, 232],
  'card-high-cheap': [232],
  'card-low': [196, 210]
}

const cardCatalog: FetchCatalog = async (itemIds) =>
  new Map(
    itemIds.flatMap((itemId) => {
      const fames = fameOfCard[itemId]

      if (fames === undefined) {
        return []
      }

      return [[itemId, cardPayload(fames)] as const]
    })
  )

test('마법부여 카드는 소유자 명성을 Neople 카드 명성보다 먼저 쓰고, 묶음은 명성이 높은 순, 같은 명성은 경매장 가격이 낮은 순, 재화 비용, 가격 없음 순이고 명성이 없는 카드는 뒤에 둔다', async (t) => {
  const exchanged: LabItemPriceRow = {
    ...row('WEAPON', 'dealer', '종결', '합성 교환 카드', null, false),
    itemId: 'card-low',
    cost: {
      currencyId: 1,
      currencyName: '합성 재화',
      currencyDescription: null,
      currencyUpdatedAt: new Date(CHECKED_AT),
      count: 10
    },
    detail: {
      description: null,
      itemRarity: null,
      iconUpdatedAt: null,
      itemTypeDetail: null,
      availableLevel: null,
      fame: 232,
      card: null
    }
  }
  const response = await requestLabItems(
    t,
    [
      cardRow('합성 낮은 명성', 'card-low', 100),
      cardRow('합성 명성 없음', 'card-missing', 50),
      cardRow('합성 비싼 카드', 'card-high', 9_000),
      exchanged,
      cardRow('합성 싼 카드', 'card-high-cheap', 1_000),
      { ...row('WEAPON', 'dealer', '종결', '합성 가격 없음', null), itemId: 'card-high' },
      row('TITLE', 'all', '종결', '합성 칭호 비싼', 900),
      row('TITLE', 'all', '종결', '합성 칭호 싼', 100)
    ],
    cardCatalog
  )

  const { groups } = (await response.json()) as {
    groups: { items: { itemName: string; fame: number | null }[] }[]
  }
  const items = groups.map(({ items }) => items.map(({ itemName, fame }) => [itemName, fame]))

  assert.deepEqual(items, [
    [
      ['합성 싼 카드', 232],
      ['합성 비싼 카드', 232],
      ['합성 교환 카드', 232],
      ['합성 가격 없음', 232],
      ['합성 낮은 명성', 210],
      ['합성 명성 없음', null]
    ],
    [
      ['합성 칭호 싼', null],
      ['합성 칭호 비싼', null]
    ]
  ])
})

test('카드가 한 번에 읽는 상한보다 많아도 모든 카드의 명성을 낸다', async (t) => {
  const itemIds = Array.from({ length: 130 }, (_, index) => `card-${index}`)
  const catalog: FetchCatalog = async (ids) => new Map(ids.map((id) => [id, cardPayload([210])]))
  const response = await requestLabItems(
    t,
    itemIds.map((itemId) => cardRow(`합성 카드 ${itemId}`, itemId, 100)),
    catalog
  )

  const { groups } = (await response.json()) as { groups: { items: { fame: number | null }[] }[] }
  const fames = groups.flatMap(({ items }) => items.map(({ fame }) => fame))

  assert.equal(fames.length, 130)
  assert.ok(fames.every((fame) => fame === 210))
})
