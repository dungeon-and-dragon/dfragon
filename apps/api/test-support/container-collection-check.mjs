import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  enqueueCollectedCharacters,
  readCollectionSummary,
  readDatabaseConfiguration,
  recordCharacter,
  recordCharacterBasic,
  recordCollectionFailure,
  requeueCollectionFailures,
  takeCollectionBatch
} from '@dfragon/database'

// 합성 캐릭터다. 기본 정보 없이 기록한 캐릭터, 저장할 캐릭터, 실패할 캐릭터 둘을 같은 목록으로 두 번 넣는다.
const withoutBasic = { serverId: 'cain', characterId: 'collect-no-basic' }
const saved = { serverId: 'cain', characterId: 'collect-saved' }
const failed = { serverId: 'siroco', characterId: 'collect-failed' }
const schemaFailed = { serverId: 'siroco', characterId: 'collect-schema' }
const characterIds = (characters) => characters.map(({ characterId }) => characterId).sort()
const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  await recordCharacter(client, {
    ...withoutBasic,
    characterName: '합성기본없음',
    adventureName: '합성수집모험단'
  })
  await enqueueCollectedCharacters(client, [withoutBasic, saved, failed, schemaFailed, saved])
  const batch = await takeCollectionBatch(client, 10)
  assert.equal(batch.length, 4)
  await recordCharacterBasic(client, {
    ...saved,
    characterName: '합성수집',
    adventureName: '합성수집모험단',
    level: 115,
    jobId: 'synthetic-job',
    jobGrowId: 'synthetic-grow',
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    fame: 60000,
    guildId: null,
    guildName: null
  })
  await recordCollectionFailure(client, failed, 'neople-api')
  await recordCollectionFailure(client, schemaFailed, 'neople-internal')
  await recordCollectionFailure(
    client,
    { serverId: 'cain', characterId: 'not-queued' },
    'neople-api'
  )
  await enqueueCollectedCharacters(client, [withoutBasic, saved, failed, schemaFailed])

  const summary = await readCollectionSummary(client)
  assert.equal(summary.waiting, 1)
  assert.ok(summary.oldestQueuedAt instanceof Date)
  assert.deepEqual(
    summary.failures.map(({ failure, count }) => `${failure}:${count}`),
    ['neople-api:1', 'neople-internal:1']
  )
  assert.ok(summary.failures.every(({ lastAttemptedAt }) => lastAttemptedAt instanceof Date))
  assert.equal(await requeueCollectionFailures(client, 'neople-internal'), 1)
  assert.deepEqual(characterIds(await takeCollectionBatch(client, 10)), [
    'collect-no-basic',
    'collect-schema'
  ])
} finally {
  await client.$disconnect()
}
