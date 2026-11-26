import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  addLabCurrency,
  createDatabaseClient,
  readLabCurrencies,
  readLabCurrencyIcon,
  readLabItemGroups,
  readLabItemDetailIcon,
  readLabItemDetails,
  readLabItemPrices,
  replaceLabItemGroup,
  saveLabItemDetail,
  updateLabCurrency
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_LAB_ITEM_PORT

const titleFinal = { category: 'TITLE', role: 'all', tier: '종결' }
const weaponDealerFinal = { category: 'WEAPON', role: 'dealer', tier: '종결' }
const pngIcon = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), contentType: 'image/png' }
const webpIcon = { bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]), contentType: 'image/webp' }

const MIGRATIONS = [
  '20261126100000_add_lab_items_auction_prices',
  '20261126200000_add_lab_currencies',
  '20261127100000_add_lab_currency_description',
  '20261127200000_add_lab_item_details'
]

function currency(name, description = null) {
  return { name, description }
}

function unpriced(itemName) {
  return { itemName, cost: null }
}

function groupOf(groups, key) {
  return groups.find(
    ({ category, role, tier }) =>
      category === key.category && role === key.role && tier === key.tier
  )
}

function namesOf(groups, key) {
  return groupOf(groups, key)?.items.map(({ itemName }) => itemName)
}

async function connectWithEmptyTables(t) {
  const client = createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: 'lab_item_test',
    username: 'lab_item_test',
    password: 'synthetic'
  })

  t.after(() => client.$disconnect())
  await client.$executeRawUnsafe(
    'DROP TABLE IF EXISTS "lab_items", "auction_prices", "lab_currencies", "lab_item_details"'
  )

  for (const name of MIGRATIONS) {
    const migration = await readFile(
      new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
      'utf8'
    )

    for (const statement of migration
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part !== '' && part !== 'BEGIN' && part !== 'COMMIT')) {
      await client.$executeRawUnsafe(statement)
    }
  }

  return client
}

async function addCurrency(client, name) {
  const addition = await addLabCurrency(client, currency(name), pngIcon)
  assert.equal(addition.status, 'added')

  return addition.id
}

test('묶음 하나를 바꾸면 그 묶음에는 새 이름만 남고 다른 묶음은 그대로다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)

  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [unpriced('합성 칭호 A'), unpriced('합성 칭호 B')]
  })
  await replaceLabItemGroup(client, { ...weaponDealerFinal, items: [unpriced('합성 카드 A')] })
  const [kept] = await client.$queryRaw`
    SELECT "created_at" AS "createdAt" FROM "lab_items" WHERE "item_name" = '합성 칭호 B'`

  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [unpriced('합성 칭호 B'), unpriced('합성 칭호 C')]
  })

  const replaced = await readLabItemGroups(client)
  assert.deepEqual(namesOf(replaced, titleFinal), ['합성 칭호 B', '합성 칭호 C'])
  assert.deepEqual(namesOf(replaced, weaponDealerFinal), ['합성 카드 A'])
  const [after] = await client.$queryRaw`
    SELECT "created_at" AS "createdAt" FROM "lab_items" WHERE "item_name" = '합성 칭호 B'`
  assert.deepEqual(after, kept)

  await replaceLabItemGroup(client, { ...titleFinal, items: [] })

  assert.deepEqual(await readLabItemGroups(client), [
    { ...weaponDealerFinal, items: [unpriced('합성 카드 A')] }
  ])
})

test('남는 이름의 재화 비용을 바꾸거나 지우면 그 묶음의 그 이름에만 반영된다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const currencyId = await addCurrency(client, '합성 재화')

  await replaceLabItemGroup(client, {
    ...weaponDealerFinal,
    items: [{ itemName: '합성 보주', cost: { currencyId, count: 5 } }, unpriced('합성 카드 A')]
  })
  await replaceLabItemGroup(client, { ...titleFinal, items: [unpriced('합성 보주')] })
  await replaceLabItemGroup(client, {
    ...weaponDealerFinal,
    items: [unpriced('합성 보주'), { itemName: '합성 카드 A', cost: { currencyId, count: 2 } }]
  })

  const groups = await readLabItemGroups(client)
  assert.deepEqual(groupOf(groups, weaponDealerFinal).items, [
    unpriced('합성 보주'),
    { itemName: '합성 카드 A', cost: { currencyId, count: 2 } }
  ])
  assert.deepEqual(groupOf(groups, titleFinal).items, [unpriced('합성 보주')])
})

test('가격은 이름으로, 재화는 비용으로 붙이고, 32bit를 넘는 가격도 숫자로 읽는다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const checkedAt = new Date('2026-11-26T00:00:00.000Z')
  const currencyId = await addCurrency(client, '합성 재화')
  const [{ updatedAt }] = await readLabCurrencies(client)

  await replaceLabItemGroup(client, {
    ...weaponDealerFinal,
    items: [unpriced('합성 카드 A'), unpriced('합성 카드 B')]
  })
  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [unpriced('합성 카드 A'), { itemName: '합성 칭호 A', cost: { currencyId, count: 3 } }]
  })
  await client.$executeRaw`
    INSERT INTO "auction_prices" ("item_name", "item_id", "item_rarity", "unit_price", "checked_at")
    VALUES
      ('합성 카드 A', 'synthetic-item', '레전더리', 3000000000, ${checkedAt}),
      ('합성 칭호 A', 'synthetic-title', '유니크', NULL, ${checkedAt})`

  const price = {
    itemId: 'synthetic-item',
    itemRarity: '레전더리',
    unitPrice: 3_000_000_000,
    checkedAt,
    cost: null,
    detail: null
  }
  const missing = {
    itemId: null,
    itemRarity: null,
    unitPrice: null,
    checkedAt: null,
    cost: null,
    detail: null
  }
  const exchanged = {
    itemId: 'synthetic-title',
    itemRarity: '유니크',
    unitPrice: null,
    checkedAt,
    cost: {
      currencyId,
      currencyName: '합성 재화',
      currencyDescription: null,
      currencyUpdatedAt: updatedAt,
      count: 3
    },
    detail: null
  }

  assert.deepEqual(await readLabItemPrices(client), [
    { ...weaponDealerFinal, itemName: '합성 카드 A', ...price },
    { ...weaponDealerFinal, itemName: '합성 카드 B', ...missing },
    { ...titleFinal, itemName: '합성 카드 A', ...price },
    { ...titleFinal, itemName: '합성 칭호 A', ...exchanged }
  ])
})

test('재화는 이름이 겹치면 더하거나 바꾸지 않고, 아이콘 없이 고치면 이름과 설명만 바꾼다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const firstId = await addCurrency(client, '합성 재화 A')
  const secondId = await addCurrency(client, '합성 재화 B')

  const addedDuplicate = await addLabCurrency(client, currency('합성 재화 A'), webpIcon)
  assert.deepEqual(addedDuplicate, { status: 'duplicate' })
  const renamedDuplicate = await updateLabCurrency(client, secondId, currency('합성 재화 A'), null)
  assert.deepEqual(renamedDuplicate, { status: 'duplicate' })
  const missing = await updateLabCurrency(client, secondId + 100, currency('합성 재화 C'), null)
  assert.deepEqual(missing, { status: 'notFound' })

  // 같은 ms 안에 고쳐도 바뀐 시각을 비교할 수 있게 먼저 시각을 과거로 돌린다.
  const before = new Date('2026-11-01T00:00:00.000Z')
  await client.$executeRaw`UPDATE "lab_currencies" SET "updated_at" = ${before}`
  const described = await updateLabCurrency(
    client,
    secondId,
    currency('합성 재화 C', '합성 설명\n둘째 줄'),
    null
  )
  assert.deepEqual(described, { status: 'updated' })
  assert.deepEqual(await readLabCurrencyIcon(client, secondId), pngIcon)

  const reiconed = await updateLabCurrency(client, firstId, currency('합성 재화 A'), webpIcon)
  assert.deepEqual(reiconed, { status: 'updated' })
  assert.deepEqual(await readLabCurrencyIcon(client, firstId), webpIcon)

  const currencies = await readLabCurrencies(client)
  assert.deepEqual(
    currencies.map(({ id, name, description }) => ({ id, name, description })),
    [
      { id: firstId, name: '합성 재화 A', description: null },
      { id: secondId, name: '합성 재화 C', description: '합성 설명\n둘째 줄' }
    ]
  )
  assert.ok(currencies.every(({ updatedAt }) => updatedAt > before))
  assert.equal(await readLabCurrencyIcon(client, secondId + 100), null)
})

test('재화 설명은 추가할 때 넣을 수 있고, 가격 읽기의 비용에 함께 실린다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const addition = await addLabCurrency(client, currency('합성 재화', '합성 설명'), pngIcon)
  assert.equal(addition.status, 'added')

  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [{ itemName: '합성 칭호 A', cost: { currencyId: addition.id, count: 2 } }]
  })

  const [row] = await readLabItemPrices(client)
  assert.equal(row.cost.currencyDescription, '합성 설명')
  assert.equal((await readLabCurrencies(client))[0].description, '합성 설명')
})

test('아이템 상세는 이름마다 한 행으로 저장하고, 아이콘을 주지 않으면 그대로 두며 null이면 지운다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const detail = { description: '합성 설명', itemRarity: '유니크' }

  await saveLabItemDetail(client, '합성 상자', detail, pngIcon)
  await saveLabItemDetail(client, '합성 상자', { description: null, itemRarity: '에픽' }, undefined)

  assert.deepEqual(await readLabItemDetailIcon(client, '합성 상자'), pngIcon)
  const savedDetails = await readLabItemDetails(client)
  assert.equal(savedDetails.length, 1)
  const [saved] = savedDetails
  assert.deepEqual(
    { ...saved, updatedAt: undefined },
    {
      itemName: '합성 상자',
      description: null,
      itemRarity: '에픽',
      hasIcon: true,
      updatedAt: undefined
    }
  )

  await saveLabItemDetail(client, '합성 상자', detail, null)

  assert.equal(await readLabItemDetailIcon(client, '합성 상자'), null)
  assert.equal((await readLabItemDetails(client))[0].hasIcon, false)
  assert.equal(await readLabItemDetailIcon(client, '없는 상자'), null)
})

test('가격 읽기는 이름으로 아이템 상세를 붙이고, 아이콘이 있을 때만 아이콘 시각을 낸다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [unpriced('합성 상자'), unpriced('합성 칭호'), unpriced('합성 카드')]
  })
  await saveLabItemDetail(
    client,
    '합성 상자',
    { description: '합성 설명', itemRarity: '유니크' },
    pngIcon
  )
  await saveLabItemDetail(client, '합성 칭호', { description: null, itemRarity: '레어' }, undefined)
  const [{ updatedAt }] = await readLabItemDetails(client)

  const details = (await readLabItemPrices(client)).map(({ itemName, detail }) => ({
    itemName,
    detail
  }))

  assert.deepEqual(details, [
    {
      itemName: '합성 상자',
      detail: { description: '합성 설명', itemRarity: '유니크', iconUpdatedAt: updatedAt }
    },
    {
      itemName: '합성 칭호',
      detail: { description: null, itemRarity: '레어', iconUpdatedAt: null }
    },
    { itemName: '합성 카드', detail: null }
  ])
})
