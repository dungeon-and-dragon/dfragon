import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createDatabaseClient, readLabItemGroups, replaceLabItemGroup } from '../dist/index.js'

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

test('묶음 하나를 바꾸면 그 묶음에는 새 이름만 남고 다른 묶음은 그대로다', {
  skip: port === undefined
}, async (t) => {
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
