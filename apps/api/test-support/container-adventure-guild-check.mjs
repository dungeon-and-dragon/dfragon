import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import {
  createDatabaseClient,
  readAdventureCharacters,
  readDatabaseConfiguration,
  readGuild,
  recordCharacter,
  recordCharacterBasic
} from '@dfragon/database'

// 합성 캐릭터다. 여러 서버에 걸친 모험단과 길드, 명성이 없는 캐릭터와 기본 정보가 없는 캐릭터를 둔다.
const job = {
  level: 115,
  jobId: 'synthetic-job',
  jobGrowId: 'synthetic-grow',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터'
}
const basic = (serverId, characterId, adventureName, fame, guildId, guildName) => ({
  ...job,
  serverId,
  characterId,
  characterName: `합성${characterId}`,
  adventureName,
  fame,
  guildId,
  guildName
})
const adventureName = '합성다서버모험단'
const guildId = 'synthetic-guild'
const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  for (const character of [
    basic('cain', 'adventure-low', adventureName, 50000, null, null),
    basic('siroco', 'adventure-high', adventureName, 70000, guildId, '합성길드'),
    basic('bakal', 'adventure-no-fame', adventureName, null, 'other-guild', '다른길드'),
    basic('hilder', 'guild-no-fame', '합성길드원모험단', null, guildId, '합성길드')
  ]) {
    await recordCharacterBasic(client, character)
  }
  await recordCharacter(client, {
    serverId: 'cain',
    characterId: 'adventure-no-basic',
    characterName: '합성기본없음',
    adventureName
  })
  // basic_fetched_at이 ms 단위라 이름을 바꾼 길드원이 확실히 가장 나중에 받은 행이 되게 한다.
  await setTimeout(5)
  await recordCharacterBasic(
    client,
    basic('cain', 'guild-renamed', '합성길드원모험단', 60001, guildId, '새합성길드')
  )

  const adventure = await readAdventureCharacters(client, adventureName)
  assert.deepEqual(
    adventure.map(({ serverId, characterId, fame }) => `${serverId}/${characterId}:${fame}`),
    [
      'siroco/adventure-high:70000',
      'cain/adventure-low:50000',
      'bakal/adventure-no-fame:null',
      'cain/adventure-no-basic:null'
    ]
  )
  const [high] = adventure
  assert.ok(high.fetchedAt instanceof Date)
  assert.deepEqual(
    { ...high, fetchedAt: undefined },
    {
      ...basic('siroco', 'adventure-high', adventureName, 70000, guildId, '합성길드'),
      fetchedAt: undefined
    }
  )
  assert.deepEqual(adventure.at(-1), {
    serverId: 'cain',
    characterId: 'adventure-no-basic',
    characterName: '합성기본없음',
    adventureName,
    level: null,
    jobId: null,
    jobGrowId: null,
    jobName: null,
    jobGrowName: null,
    fame: null,
    guildId: null,
    guildName: null,
    fetchedAt: null
  })

  const guild = await readGuild(client, guildId)
  assert.equal(guild.guildName, '새합성길드')
  assert.deepEqual(
    guild.members.map(({ serverId, characterId }) => `${serverId}/${characterId}`),
    ['siroco/adventure-high', 'cain/guild-renamed', 'hilder/guild-no-fame']
  )

  assert.deepEqual(await readAdventureCharacters(client, '없는모험단'), [])
  assert.deepEqual(await readGuild(client, 'missing-guild'), { guildName: null, members: [] })
} finally {
  await client.$disconnect()
}
