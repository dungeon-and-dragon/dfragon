import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  deleteAuctionPriceHistoryBefore,
  readAuctionPriceHistory,
  readLabItemPriceTargets,
  recordAuctionPrice
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_AUCTION_PRICE_PORT
const database = 'auction_price'
const rejectedHistoryPricePattern = /test_reject_price/

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

// 이름은 지금은 지운 마법부여 등급표에 있던 카드 이름이고, itemId와 가격은 지어냈다.
const shared = '허망한 맹신, 호스디그 카드'
const single = '거짓의 베리디쿠스 카드'
const readPrices = () =>
  client.auctionPrice.findMany({
    select: { itemName: true, itemId: true, itemRarity: true, unitPrice: true, checkedAt: true },
    orderBy: { itemName: 'asc' }
  })

test('두 묶음에 겹친 이름은 한 번만 읽어 종류를 모으고, 한 묶음에서라도 재화 비용이 있으면 교환 아이템으로 읽는다', {
  skip: port === undefined
}, async () => {
  const currency = await client.labCurrency.create({
    data: { name: '합성 재화', icon: new Uint8Array([1]), iconContentType: 'image/png' }
  })
  const cost = { currencyId: currency.id, currencyCount: 5 }
  await client.labItem.createMany({
    data: [
      { category: 'WEAPON', role: 'dealer', tier: 'semi', itemName: shared, ...cost },
      { category: 'WEAPON', role: 'buffer', tier: 'end', itemName: shared },
      { category: 'JACKET', role: 'buffer', tier: 'end', itemName: shared },
      { category: 'TITLE', role: 'all', tier: 'end', itemName: single }
    ]
  })

  const targets = await readLabItemPriceTargets(client)

  assert.deepEqual(
    targets.toSorted((left, right) => left.itemName.localeCompare(right.itemName)),
    [
      { itemName: shared, exchanged: true, categories: ['JACKET', 'WEAPON'] },
      { itemName: single, exchanged: false, categories: ['TITLE'] }
    ].toSorted((left, right) => left.itemName.localeCompare(right.itemName))
  )
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

test('가격 이력은 같은 값을 24시간 안에 생략하고 가격, 아이템 id 변경과 24시간 경계에 기록한다', {
  skip: port === undefined
}, async () => {
  const price = {
    itemName: '합성 이력 아이템',
    itemId: 'synthetic-a',
    itemRarity: '레어',
    unitPrice: 3_000_000_000,
    checkedAt: new Date('2026-11-01T00:00:00Z')
  }
  await recordAuctionPrice(client, price)
  await recordAuctionPrice(client, {
    ...price,
    itemRarity: '유니크',
    checkedAt: new Date('2026-11-01T23:59:59.999Z')
  })
  assert.equal((await readAuctionPriceHistory(client, price.itemName)).length, 1)
  const daily = { ...price, checkedAt: new Date('2026-11-02T00:00:00Z') }
  const changed = {
    ...price,
    unitPrice: 4_000_000_000,
    checkedAt: new Date('2026-11-02T00:10:00Z')
  }
  const otherId = { ...changed, itemId: 'synthetic-b', checkedAt: new Date('2026-11-02T00:20:00Z') }
  const noListing = { ...otherId, unitPrice: null, checkedAt: new Date('2026-11-02T00:30:00Z') }
  const noItem = { ...noListing, itemId: null, checkedAt: new Date('2026-11-02T00:40:00Z') }
  for (const entry of [daily, changed, otherId, noListing, noItem]) {
    await recordAuctionPrice(client, entry)
  }
  await recordAuctionPrice(client, { ...noItem, checkedAt: new Date('2026-11-02T00:50:00Z') })
  const history = await readAuctionPriceHistory(client, price.itemName)
  assert.deepEqual(
    history.map(({ id, ...entry }) => entry),
    [noItem, noListing, otherId, changed, daily, price].map(({ itemRarity, ...entry }) => entry)
  )
  assert.ok(history.every(({ id }) => typeof id === 'number'))
  assert.deepEqual(await readAuctionPriceHistory(client, '없는 합성 아이템'), [])

  const before = await client.auctionPriceHistory.count({
    where: { checkedAt: { lt: daily.checkedAt } }
  })
  assert.equal(await deleteAuctionPriceHistoryBefore(client, daily.checkedAt), before)
  assert.deepEqual(
    (await readAuctionPriceHistory(client, price.itemName)).map(({ checkedAt }) => checkedAt),
    [noItem.checkedAt, noListing.checkedAt, otherId.checkedAt, changed.checkedAt, daily.checkedAt]
  )
  assert.equal(await deleteAuctionPriceHistoryBefore(client, daily.checkedAt), 0)
  const latest = await client.auctionPrice.findUnique({ where: { itemName: price.itemName } })
  assert.deepEqual(latest.checkedAt, new Date('2026-11-02T00:50:00Z'))
})

test('같은 이름과 가격을 동시에 처음 저장해도 이력은 한 줄이다', {
  skip: port === undefined
}, async () => {
  const price = {
    itemName: '합성 동시 저장',
    itemId: 'synthetic-concurrent',
    itemRarity: null,
    unitPrice: 100,
    checkedAt: new Date('2026-11-03T00:00:00Z')
  }
  await Promise.all([recordAuctionPrice(client, price), recordAuctionPrice(client, price)])
  const history = await readAuctionPriceHistory(client, price.itemName)
  assert.deepEqual(
    history.map(({ id, ...entry }) => entry),
    [
      {
        itemName: price.itemName,
        itemId: price.itemId,
        unitPrice: 100,
        checkedAt: price.checkedAt
      }
    ]
  )
})

test('이력 저장이 실패하면 최신 가격 변경도 rollback한다', {
  skip: port === undefined
}, async () => {
  const price = {
    itemName: '합성 rollback',
    itemId: 'synthetic-rollback',
    itemRarity: null,
    unitPrice: 100,
    checkedAt: new Date('2026-11-04T00:00:00Z')
  }
  await recordAuctionPrice(client, price)
  await client.$executeRaw`
    ALTER TABLE "auction_price_history" ADD CONSTRAINT "test_reject_price" CHECK ("unit_price" <> 200)`
  try {
    await assert.rejects(
      recordAuctionPrice(client, {
        ...price,
        unitPrice: 200,
        checkedAt: new Date('2026-11-04T01:00:00Z')
      }),
      rejectedHistoryPricePattern
    )
    const latest = await client.auctionPrice.findUnique({ where: { itemName: price.itemName } })
    assert.deepEqual(latest, { ...price, unitPrice: 100n })
    assert.deepEqual(
      (await readAuctionPriceHistory(client, price.itemName)).map(({ unitPrice }) => unitPrice),
      [100]
    )
  } finally {
    await client.$executeRaw`ALTER TABLE "auction_price_history" DROP CONSTRAINT "test_reject_price"`
  }
})
