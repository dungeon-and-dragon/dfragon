import {
  createDatabaseClient,
  readDatabaseConfiguration,
  replaceEnhancementBackfillRange
} from '@dfragon/database'

// 중천 시작 전 합성 증폭 행이다. 실제 캐릭터, Neople 응답과 관계없다.
const amplify = {
  code: 402,
  occurredAt: new Date('2020-01-01T00:00:00+09:00'),
  name: '아이템 증폭',
  itemId: 'synthetic-item',
  itemName: '합성 아이템',
  itemRarity: '에픽',
  data: { before: 9, after: 10, result: true }
}
const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  await replaceEnhancementBackfillRange(
    client,
    { serverId: 'cain', characterId: 'synthetic-character' },
    { start: new Date('2019-12-01T00:00:00+09:00'), end: new Date('2020-02-01T00:00:00+09:00') },
    [401, 402, 403],
    [amplify]
  )
} finally {
  await client.$disconnect()
}
