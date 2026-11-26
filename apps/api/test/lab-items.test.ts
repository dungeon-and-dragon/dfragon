import assert from 'node:assert/strict'
import test from 'node:test'
import type { LabItemPriceRow } from '@dfragon/database'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { LabItemRepository } from '../src/application/lab-items/repository.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

const unusedProvider = async () => assert.fail('실험실 아이템 경로는 Neople을 부르면 안 된다')

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
      cost: null
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
    cost: null
  }
}

async function startApi(
  t: test.TestContext,
  rows: LabItemPriceRow[],
  readCurrencyIcon: LabItemRepository['readCurrencyIcon'] = async () => null
) {
  const labItems: LabItemRepository = { readLabItemPrices: async () => rows, readCurrencyIcon }
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: { fetchDetails: unusedProvider, catalog: new CatalogService(unusedProvider) },
    todayGrade: { fetchShopGrade: unusedProvider },
    labItems,
    writeAccessLog: () => undefined
  })

  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string) => fetch(`${origin}${path}`)
}

async function requestLabItems(t: test.TestContext, rows: LabItemPriceRow[]) {
  const request = await startApi(t, rows)

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
            unitPrice: 900,
            checkedAt: CHECKED_AT,
            cost: null
          },
          {
            itemName: '합성 카드 중간',
            itemId: 'synthetic-item',
            itemRarity: '레전더리',
            unitPrice: 10_000,
            checkedAt: CHECKED_AT,
            cost: null
          },
          {
            itemName: '합성 카드 비싼',
            itemId: 'synthetic-item',
            itemRarity: '레전더리',
            unitPrice: 3_000_000_000,
            checkedAt: CHECKED_AT,
            cost: null
          },
          {
            itemName: '합성 카드 가',
            itemId: null,
            itemRarity: null,
            unitPrice: null,
            checkedAt: null,
            cost: null
          },
          {
            itemName: '합성 카드 다',
            itemId: null,
            itemRarity: null,
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

test('재화 비용을 붙인 아이템은 경매장 가격 없이 재화 이름, 개수와 바꾼 시각이 든 아이콘 경로를 낸다', async (t) => {
  const currencyUpdatedAt = new Date('2026-11-27T01:02:03.004Z')
  const exchanged: LabItemPriceRow = {
    ...row('WEAPON', 'dealer', '준종결', '합성 보주', 5_000),
    itemRarity: '유니크',
    cost: { currencyId: 7, currencyName: '합성 재화', currencyUpdatedAt, count: 5 }
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
            unitPrice: null,
            checkedAt: CHECKED_AT,
            cost: {
              currencyName: '합성 재화',
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
