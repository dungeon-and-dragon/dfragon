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
      checkedAt: null
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
    checkedAt: new Date(CHECKED_AT)
  }
}

async function requestLabItems(t: test.TestContext, rows: LabItemPriceRow[]) {
  const labItems: LabItemRepository = { readLabItemPrices: async () => rows }
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

  return fetch(`${origin}/lab/items`)
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
            checkedAt: CHECKED_AT
          },
          {
            itemName: '합성 카드 중간',
            itemId: 'synthetic-item',
            itemRarity: '레전더리',
            unitPrice: 10_000,
            checkedAt: CHECKED_AT
          },
          {
            itemName: '합성 카드 비싼',
            itemId: 'synthetic-item',
            itemRarity: '레전더리',
            unitPrice: 3_000_000_000,
            checkedAt: CHECKED_AT
          },
          {
            itemName: '합성 카드 가',
            itemId: null,
            itemRarity: null,
            unitPrice: null,
            checkedAt: null
          },
          {
            itemName: '합성 카드 다',
            itemId: null,
            itemRarity: null,
            unitPrice: null,
            checkedAt: CHECKED_AT
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
            checkedAt: null
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
