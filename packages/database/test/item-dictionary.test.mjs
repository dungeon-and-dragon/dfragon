import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  readItemDictionary,
  readUnlistedAcquisitionItemIds,
  readUnlistedItemIds,
  recordItemDictionary,
  replaceTimelineRange
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_ITEM_DICTIONARY_PORT
const database = 'item_dictionary'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'dictionary_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('dictionary_test')

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`)
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
  } finally {
    await admin.$disconnect()
  }

  const environment = { ...process.env }
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1',
    DB_PORT: port,
    DB_NAME: database,
    DB_USERNAME: 'dictionary_test',
    DB_PASSWORD: 'synthetic'
  })

  try {
    await applyMigrations()
  } finally {
    process.env = environment
  }

  client = connect(database)
})

after(() => client?.$disconnect())

// 합성 itemId와 타임라인 행이다. 실제 Neople 응답과 관계없다. 칭호는 실제 응답처럼 액세서리, 레벨 1로 둔다.
const ids = {
  weapon: 'a'.repeat(32),
  title: 'b'.repeat(32),
  missing: 'c'.repeat(32),
  rare: 'd'.repeat(32),
  oath: 'e'.repeat(32),
  beforeSeason: 'f'.repeat(32),
  armor: '1'.repeat(32),
  oldVersion: '2'.repeat(32)
}
const at = (time) => new Date(`${time}+09:00`)
const acquisition = (code, occurredAt, itemId, itemRarity) => ({
  code,
  occurredAt,
  name: '아이템 획득',
  itemId,
  itemName: '합성 아이템',
  itemRarity,
  data: { itemId, itemRarity }
})

test('사전에 저장한 행은 레벨과 종류를 그대로 읽고, 이미 있는 itemId를 다시 저장해도 먼저 저장한 행이 남는다', {
  skip: port === undefined
}, async () => {
  await recordItemDictionary(client, [
    { itemId: ids.weapon, availableLevel: 115, itemType: '무기' },
    { itemId: ids.title, availableLevel: 1, itemType: '액세서리' },
    { itemId: ids.missing, availableLevel: null, itemType: null }
  ])
  await recordItemDictionary(client, [{ itemId: ids.weapon, availableLevel: null, itemType: null }])

  const stored = await client.item.findMany({
    select: { itemId: true, availableLevel: true, itemType: true },
    orderBy: { itemId: 'asc' }
  })
  assert.deepEqual(
    stored.filter(({ itemId }) => [ids.weapon, ids.title, ids.missing].includes(itemId)),
    [
      { itemId: ids.weapon, availableLevel: 115, itemType: '무기' },
      { itemId: ids.title, availableLevel: 1, itemType: '액세서리' },
      { itemId: ids.missing, availableLevel: null, itemType: null }
    ]
  )
  assert.deepEqual(
    await readUnlistedItemIds(client, [ids.weapon, ids.rare, ids.rare, ids.missing]),
    [ids.rare]
  )
})

test('사전에 없는 획득 itemId는 고른 code와 등급, 시작 시각 뒤의 행에서만 한 번씩 읽는다', {
  skip: port === undefined
}, async () => {
  const character = { serverId: 'cain', characterId: 'item-dictionary' }
  const range = { start: at('2024-12-01T00:00:00'), end: at('2025-02-01T00:00:00') }
  await recordItemDictionary(client, [
    { itemId: ids.weapon, availableLevel: 115, itemType: '무기' }
  ])
  await replaceTimelineRange(
    client,
    character,
    range,
    [],
    [
      acquisition(505, at('2025-01-10T00:00:00'), ids.weapon, '태초'),
      acquisition(505, at('2025-01-10T01:00:00'), ids.rare, '에픽'),
      acquisition(513, at('2025-01-10T02:00:00'), ids.rare, '에픽'),
      acquisition(505, at('2025-01-10T03:00:00'), ids.oath, '레어'),
      acquisition(550, at('2025-01-10T04:00:00'), ids.oath, '태초'),
      acquisition(505, at('2025-01-01T00:00:00'), ids.beforeSeason, '태초')
    ]
  )

  assert.deepEqual(
    await readUnlistedAcquisitionItemIds(client, {
      codes: [505, 513],
      itemRarities: ['에픽', '태초'],
      since: at('2025-01-09T06:00:00')
    }),
    [ids.rare]
  )
})

test('세트, 부위, 등급 열을 더한 뒤에도 기존 사전 함수의 쓰기와 읽기는 실패하지 않고 새 열은 null로 남는다', {
  skip: port === undefined
}, async () => {
  const setItemId = '9'.repeat(32)
  const filledArmor = {
    itemId: ids.armor,
    availableLevel: 115,
    itemType: '방어구',
    itemTypeDetail: '상의',
    itemRarity: '에픽',
    setItemId,
    setItemName: '합성 세트'
  }
  await client.item.create({ data: filledArmor })
  await recordItemDictionary(client, [
    { itemId: ids.armor, availableLevel: null, itemType: null },
    { itemId: ids.oldVersion, availableLevel: 115, itemType: '방어구' }
  ])

  const dictionary = await readItemDictionary(client, [ids.armor, ids.oldVersion])
  assert.deepEqual(
    dictionary.toSorted((a, b) => a.itemId.localeCompare(b.itemId)),
    [
      { itemId: ids.armor, availableLevel: 115, itemType: '방어구' },
      { itemId: ids.oldVersion, availableLevel: 115, itemType: '방어구' }
    ]
  )
  assert.deepEqual(
    await client.item.findMany({
      where: { itemId: { in: [ids.armor, ids.oldVersion] } },
      select: {
        itemId: true,
        itemTypeDetail: true,
        itemRarity: true,
        setItemId: true,
        setItemName: true
      },
      orderBy: { itemId: 'asc' }
    }),
    [
      {
        itemId: ids.armor,
        itemTypeDetail: '상의',
        itemRarity: '에픽',
        setItemId,
        setItemName: '합성 세트'
      },
      {
        itemId: ids.oldVersion,
        itemTypeDetail: null,
        itemRarity: null,
        setItemId: null,
        setItemName: null
      }
    ]
  )
})
