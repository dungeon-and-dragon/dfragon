import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  readLabItemNames,
  recordAuctionPrice
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_AUCTION_PRICE_PORT
const database = 'auction_price'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'auction_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('auction_test')

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
    DB_USERNAME: 'auction_test',
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

// 이름은 저장소의 마법부여 등급표에 있는 카드 이름이고, itemId와 가격은 지어냈다.
const shared = '허망한 맹신, 호스디그 카드'
const single = '거짓의 베리디쿠스 카드'
const readPrices = () =>
  client.auctionPrice.findMany({
    select: { itemName: true, itemId: true, itemRarity: true, unitPrice: true, checkedAt: true },
    orderBy: { itemName: 'asc' }
  })

test('두 묶음에 겹친 실험실 아이템 이름은 한 번만 읽는다', {
  skip: port === undefined
}, async () => {
  await client.labItem.createMany({
    data: [
      { category: 'WEAPON', role: 'dealer', tier: 'semi', itemName: shared },
      { category: 'WEAPON', role: 'buffer', tier: 'end', itemName: shared },
      { category: 'TITLE', role: 'all', tier: 'end', itemName: single }
    ]
  })

  assert.deepEqual((await readLabItemNames(client)).toSorted(), [shared, single].toSorted())
})

test('가격을 다시 받으면 그 이름의 행만 바꾸고, 매물이 없으면 가격을 비운 채 확인 시각을 갱신한다', {
  skip: port === undefined
}, async () => {
  const first = new Date('2026-11-26T03:00:00Z')
  const later = new Date('2026-11-26T03:10:00Z')
  const sharedPrice = {
    itemName: shared,
    itemId: 'a'.repeat(32),
    itemRarity: '유니크',
    unitPrice: 3_000_000_000,
    checkedAt: first
  }
  const singlePrice = {
    itemName: single,
    itemId: 'b'.repeat(32),
    itemRarity: '레전더리',
    unitPrice: 15_000,
    checkedAt: first
  }

  await recordAuctionPrice(client, sharedPrice)
  await recordAuctionPrice(client, singlePrice)
  await recordAuctionPrice(client, {
    itemName: shared,
    itemId: null,
    itemRarity: null,
    unitPrice: null,
    checkedAt: later
  })

  assert.deepEqual(await readPrices(), [
    { ...singlePrice, unitPrice: 15_000n },
    { itemName: shared, itemId: null, itemRarity: null, unitPrice: null, checkedAt: later }
  ])
})
