import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  createDatabaseClient,
  readCharactersTimelineEvents,
  readCharactersTimelineItems,
  readRecentTimelineItems,
  readTimelineEvents
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_TIMELINE_ORDER_PORT
const migrationsDirectory = new URL('../prisma/migrations/', import.meta.url)

const portNumber = Number(port)

const connect = (database) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: portNumber,
    database,
    username: 'timeline_order_test',
    password: 'synthetic'
  })

async function migratedDatabase(t, database) {
  const admin = connect('timeline_order_test')

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`)
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
  } finally {
    await admin.$disconnect()
  }

  const client = connect(database)
  t.after(() => client.$disconnect())

  const names = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .toSorted()

  for (const name of names) {
    const sql = await readFile(new URL(`${name}/migration.sql`, migrationsDirectory), 'utf8')

    for (const statement of sql
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)) {
      await client.$executeRawUnsafe(statement)
    }
  }

  return client
}

// 합성 캐릭터와 타임라인 행이다. 실제 캐릭터, Neople 응답과 관계없다.
const character = { serverId: 'cain', characterId: 'name-order' }
const since = new Date('2020-01-01T00:00:00+09:00')
const sameMinute = new Date('2020-02-01T10:00:00+09:00')
const earlier = new Date('2020-02-01T09:00:00+09:00')

// Neople은 분 단위 시각으로 최신 행을 먼저 주고 그 순서대로 저장하므로 같은 분의 더 최근 행이 더 작은 id를 받는다.
const storedNewestFirst = (code) => [
  { code, occurredAt: sameMinute, name: '나중', raidName: null, data: {} },
  { code, occurredAt: sameMinute, name: '먼저', raidName: null, data: {} },
  { code, occurredAt: earlier, name: '이전 분', raidName: null, data: {} }
]
const itemRows = (rows) =>
  rows.map(({ raidName, ...row }) => ({ ...row, itemId: null, itemName: null, itemRarity: null }))
const names = (rows) => rows.map(({ name }) => name)

test('같은 분에 최신 순으로 저장된 행도 오래된 것부터 읽는다', {
  skip: port === undefined
}, async (t) => {
  const client = await migratedDatabase(t, 'timeline_order_oldest_first')
  const events = storedNewestFirst(102).map((row) => ({ ...character, ...row }))
  const items = itemRows(storedNewestFirst(402)).map((row) => ({ ...character, ...row }))
  const oldestFirst = ['이전 분', '먼저', '나중']

  await client.timelineEvent.createMany({ data: events })
  await client.timelineItem.createMany({ data: items })

  assert.deepEqual(names(await readTimelineEvents(client, character, [102], since)), oldestFirst)
  assert.deepEqual(
    names(await readCharactersTimelineEvents(client, [character], [102], since)),
    oldestFirst
  )
  assert.deepEqual(
    names(await readCharactersTimelineItems(client, [character], [402], since)),
    oldestFirst
  )
})

test('같은 분에 최신 순으로 저장된 아이템을 최근 것부터 읽고 cursor 뒤에서 이어 읽는다', {
  skip: port === undefined
}, async (t) => {
  const client = await migratedDatabase(t, 'timeline_order_recent_first')
  const items = itemRows(storedNewestFirst(402)).map((row) => ({ ...character, ...row }))
  const query = { codes: [402], limit: 1 }
  const newestFirst = ['나중', '먼저', '이전 분']

  await client.timelineItem.createMany({ data: items })

  assert.deepEqual(
    names(await readRecentTimelineItems(client, character, { ...query, limit: 10 })),
    newestFirst
  )

  const pages = []
  let before

  for (let page = 0; page < newestFirst.length; page++) {
    const [row] = await readRecentTimelineItems(client, character, { ...query, before })
    pages.push(row.name)
    before = { occurredAt: row.occurredAt, id: row.id }
  }

  assert.deepEqual(pages, newestFirst)
  assert.deepEqual(await readRecentTimelineItems(client, character, { ...query, before }), [])
})
