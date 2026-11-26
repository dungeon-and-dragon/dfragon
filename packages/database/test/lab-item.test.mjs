import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  createDatabaseClient,
  readLabItemGroups,
  readLabItemPrices,
  replaceLabItemGroup
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_LAB_ITEM_PORT

const titleFinal = { category: 'TITLE', role: 'all', tier: '종결' }
const weaponDealerFinal = { category: 'WEAPON', role: 'dealer', tier: '종결' }

function namesOf(groups, key) {
  const group = groups.find(
    ({ category, role, tier }) =>
      category === key.category && role === key.role && tier === key.tier
  )

  return group?.itemNames
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
  const migration = await readFile(
    new URL(
      '../prisma/migrations/20261126100000_add_lab_items_auction_prices/migration.sql',
      import.meta.url
    ),
    'utf8'
  )

  await client.$executeRawUnsafe('DROP TABLE IF EXISTS "lab_items", "auction_prices"')

  for (const statement of migration
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '' && part !== 'BEGIN' && part !== 'COMMIT')) {
    await client.$executeRawUnsafe(statement)
  }

  return client
}

test('묶음 하나를 바꾸면 그 묶음에는 새 이름만 남고 다른 묶음은 그대로다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)

  await replaceLabItemGroup(client, { ...titleFinal, itemNames: ['합성 칭호 A', '합성 칭호 B'] })
  await replaceLabItemGroup(client, { ...weaponDealerFinal, itemNames: ['합성 카드 A'] })
  const [kept] = await client.$queryRaw`
    SELECT "created_at" AS "createdAt" FROM "lab_items" WHERE "item_name" = '합성 칭호 B'`

  await replaceLabItemGroup(client, { ...titleFinal, itemNames: ['합성 칭호 B', '합성 칭호 C'] })

  const replaced = await readLabItemGroups(client)
  assert.deepEqual(namesOf(replaced, titleFinal), ['합성 칭호 B', '합성 칭호 C'])
  assert.deepEqual(namesOf(replaced, weaponDealerFinal), ['합성 카드 A'])
  const [after] = await client.$queryRaw`
    SELECT "created_at" AS "createdAt" FROM "lab_items" WHERE "item_name" = '합성 칭호 B'`
  assert.deepEqual(after, kept)

  await replaceLabItemGroup(client, { ...titleFinal, itemNames: [] })

  assert.deepEqual(await readLabItemGroups(client), [
    { ...weaponDealerFinal, itemNames: ['합성 카드 A'] }
  ])
})

test('가격은 이름으로 붙이고, 가격 행이 없으면 가격 열이 모두 null이며 32bit를 넘는 가격도 숫자로 읽는다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const checkedAt = new Date('2026-11-26T00:00:00.000Z')

  await replaceLabItemGroup(client, {
    ...weaponDealerFinal,
    itemNames: ['합성 카드 A', '합성 카드 B']
  })
  await replaceLabItemGroup(client, { ...titleFinal, itemNames: ['합성 카드 A', '합성 칭호 A'] })
  await client.$executeRaw`
    INSERT INTO "auction_prices" ("item_name", "item_id", "item_rarity", "unit_price", "checked_at")
    VALUES
      ('합성 카드 A', 'synthetic-item', '레전더리', 3000000000, ${checkedAt}),
      ('합성 칭호 A', NULL, NULL, NULL, ${checkedAt})`

  const price = {
    itemId: 'synthetic-item',
    itemRarity: '레전더리',
    unitPrice: 3_000_000_000,
    checkedAt
  }
  const missing = { itemId: null, itemRarity: null, unitPrice: null, checkedAt: null }
  const soldOut = { itemId: null, itemRarity: null, unitPrice: null, checkedAt }

  assert.deepEqual(await readLabItemPrices(client), [
    { ...weaponDealerFinal, itemName: '합성 카드 A', ...price },
    { ...weaponDealerFinal, itemName: '합성 카드 B', ...missing },
    { ...titleFinal, itemName: '합성 카드 A', ...price },
    { ...titleFinal, itemName: '합성 칭호 A', ...soldOut }
  ])
})
