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
  legacyArmor: '2'.repeat(32),
  craftedOath: '3'.repeat(32),
  oldVersion: '4'.repeat(32),
  unfilledArmor: '5'.repeat(32),
  otherCode: '6'.repeat(32),
  vanishedArmor: '7'.repeat(32)
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
const emptyEntry = (itemId) => ({
  itemId,
  availableLevel: null,
  itemType: null,
  itemTypeDetail: null,
  itemRarity: null,
  setItemId: null,
  setItemName: null
})
const armorEntry = (itemId, itemRarity) => ({
  itemId,
  availableLevel: 115,
  itemType: '방어구',
  itemTypeDetail: '상의',
  itemRarity,
  setItemId: '9'.repeat(32),
  setItemName: '합성 세트'
})
// 세트, 부위, 등급 열을 더하기 전의 코드가 쓰던 읽기와 쓰기다.
const recordLegacyEntries = (entries) =>
  client.item.createMany({ data: entries, skipDuplicates: true })
const readLegacyEntries = (itemIds) =>
  client.item.findMany({
    where: { itemId: { in: itemIds } },
    select: { itemId: true, availableLevel: true, itemType: true },
    orderBy: { itemId: 'asc' }
  })
const readStored = (itemIds) =>
  client.item.findMany({
    where: { itemId: { in: itemIds } },
    select: {
      itemId: true,
      availableLevel: true,
      itemType: true,
      itemTypeDetail: true,
      itemRarity: true,
      setItemId: true,
      setItemName: true
    },
    orderBy: { itemId: 'asc' }
  })

test('세트가 없는 아이템은 세트 열만 비워 저장하고, 이미 채운 itemId를 다시 저장해도 먼저 채운 행이 남는다', {
  skip: port === undefined
}, async () => {
  const weapon = {
    ...emptyEntry(ids.weapon),
    availableLevel: 115,
    itemType: '무기',
    itemTypeDetail: '대검',
    itemRarity: '에픽'
  }

  const title = {
    ...emptyEntry(ids.title),
    availableLevel: 1,
    itemType: '액세서리',
    itemTypeDetail: '칭호',
    itemRarity: '레어'
  }

  await recordItemDictionary(client, [weapon, title, emptyEntry(ids.missing)])
  await recordItemDictionary(client, [emptyEntry(ids.weapon), emptyEntry(ids.missing)])

  assert.deepEqual(await readStored([ids.weapon, ids.title, ids.missing]), [
    weapon,
    title,
    emptyEntry(ids.missing)
  ])
  assert.deepEqual(
    await readUnlistedItemIds(client, [ids.weapon, ids.rare, ids.rare, ids.missing]),
    [ids.rare]
  )
})

test('종류는 있고 등급이 빈 옛 행은 다시 묻고, 새 값을 저장하면 그 행을 바꾼다', {
  skip: port === undefined
}, async () => {
  await recordLegacyEntries([{ itemId: ids.legacyArmor, availableLevel: 115, itemType: '방어구' }])

  assert.deepEqual(await readUnlistedItemIds(client, [ids.legacyArmor]), [ids.legacyArmor])

  await recordItemDictionary(client, [armorEntry(ids.legacyArmor, '태초')])

  assert.deepEqual(await readItemDictionary(client, [ids.legacyArmor]), [
    armorEntry(ids.legacyArmor, '태초')
  ])
  assert.deepEqual(await readUnlistedItemIds(client, [ids.legacyArmor]), [])
})

test('채운 옛 행에 Neople이 행을 주지 않으면 레벨과 종류가 남고 다음 채우기에서 다시 묻는다', {
  skip: port === undefined
}, async () => {
  await recordLegacyEntries([
    { itemId: ids.vanishedArmor, availableLevel: 115, itemType: '방어구' }
  ])
  await recordItemDictionary(client, [emptyEntry(ids.vanishedArmor)])

  assert.deepEqual(await readLegacyEntries([ids.vanishedArmor]), [
    { itemId: ids.vanishedArmor, availableLevel: 115, itemType: '방어구' }
  ])
  assert.deepEqual(await readUnlistedItemIds(client, [ids.vanishedArmor]), [ids.vanishedArmor])
})

test('세트, 부위, 등급 열이 있어도 옛 코드의 사전 쓰기와 읽기는 실패하지 않는다', {
  skip: port === undefined
}, async () => {
  await recordItemDictionary(client, [armorEntry(ids.armor, '에픽')])
  await recordLegacyEntries([
    { itemId: ids.armor, availableLevel: null, itemType: null },
    { itemId: ids.oldVersion, availableLevel: 115, itemType: '방어구' }
  ])

  assert.deepEqual(await readLegacyEntries([ids.armor, ids.oldVersion]), [
    { itemId: ids.armor, availableLevel: 115, itemType: '방어구' },
    { itemId: ids.oldVersion, availableLevel: 115, itemType: '방어구' }
  ])
})

test('사전에 없거나 등급이 빈 획득 itemId는 고른 장비 code와 등급, 서약 code, 시작 시각 뒤의 행에서만 한 번씩 읽는다', {
  skip: port === undefined
}, async () => {
  const character = { serverId: 'cain', characterId: 'item-dictionary' }
  const range = { start: at('2024-12-01T00:00:00'), end: at('2025-02-01T00:00:00') }
  const legacyCharacter = { serverId: 'cain', characterId: 'item-dictionary-legacy' }

  await recordItemDictionary(client, [armorEntry(ids.weapon, '태초')])
  await recordLegacyEntries([
    { itemId: ids.unfilledArmor, availableLevel: 115, itemType: '방어구' }
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
      acquisition(554, at('2025-01-10T05:00:00'), ids.craftedOath, '레어'),
      acquisition(505, at('2025-01-01T00:00:00'), ids.beforeSeason, '태초'),
      acquisition(560, at('2025-01-10T06:00:00'), ids.otherCode, '태초')
    ]
  )
  await replaceTimelineRange(
    client,
    legacyCharacter,
    range,
    [],
    [acquisition(505, at('2025-01-10T00:00:00'), ids.unfilledArmor, '에픽')]
  )

  assert.deepEqual(
    await readUnlistedAcquisitionItemIds(client, {
      equipmentCodes: [505, 513],
      equipmentRarities: ['에픽', '태초'],
      oathCodes: [550, 554],
      since: at('2025-01-09T06:00:00')
    }),
    [ids.unfilledArmor, ids.craftedOath, ids.rare, ids.oath].toSorted()
  )
})
