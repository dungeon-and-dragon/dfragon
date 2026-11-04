import {
  createDatabaseClient,
  readDatabaseConfiguration,
  replaceTimelineRange
} from '@dfragon/database'

// 같은 분에 같은 내용의 행이 인자 수만큼 있는 합성 타임라인이다. 구간 끝 분도 교체 대상에 들어가는지 보려고 구간 끝에 둔다.
const occurredAt = new Date('2026-04-01T00:00:00+09:00')
const event = { code: 201, occurredAt, name: '레이드', raidName: '합성 레이드', data: { probe: 1 } }
const item = {
  code: 505,
  occurredAt,
  name: '아이템 획득(던전 드랍)',
  itemId: 'synthetic-item',
  itemName: '합성 아이템',
  itemRarity: '에픽',
  data: { probe: 1 }
}
const copies = Number(process.argv[2])
const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  await replaceTimelineRange(
    client,
    { serverId: 'cain', characterId: 'synthetic-character' },
    { start: new Date('2026-03-01T00:00:00+09:00'), end: new Date('2026-04-01T00:00:00+09:00') },
    Array(copies).fill(event),
    Array(copies).fill(item)
  )
} finally {
  await client.$disconnect()
}
