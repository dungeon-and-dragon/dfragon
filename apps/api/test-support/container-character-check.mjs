import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readDatabaseConfiguration,
  recordCharacter,
  recordCharacterBasic
} from '@dfragon/database'

// 합성 캐릭터다. 다른 서버의 같은 모험단 캐릭터를 기록한 뒤 한 캐릭터의 모험단, 캐릭터 이름을 바꾼다.
const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  for (const character of [
    {
      serverId: 'cain',
      characterId: 'synthetic-a',
      characterName: '합성A',
      adventureName: '합성모험단'
    },
    {
      serverId: 'siroco',
      characterId: 'synthetic-b',
      characterName: '합성B',
      adventureName: '합성모험단'
    },
    {
      serverId: 'cain',
      characterId: 'synthetic-a',
      characterName: '합성A2',
      adventureName: '새모험단'
    }
  ]) {
    await recordCharacter(client, character)
  }

  const basic = {
    serverId: 'cain',
    characterId: 'max-fame-probe',
    characterName: '합성최고명성',
    adventureName: '합성최고명성모험단',
    level: 115,
    jobId: 'synthetic-job',
    jobGrowId: 'synthetic-grow',
    jobName: '합성직업',
    jobGrowName: '합성전직',
    guildId: null,
    guildName: null,
    fame: 60000
  }
  const readFame = (characterId) =>
    client.character.findUniqueOrThrow({
      where: { serverId_characterId: { serverId: basic.serverId, characterId } },
      select: { fame: true, maxFame: true }
    })
  for (const [fame, maxFame] of [
    [60000, 60000],
    [50000, 60000],
    [70000, 70000],
    [null, 70000],
    [0, 70000]
  ]) {
    await recordCharacterBasic(client, { ...basic, fame })
    assert.deepEqual(await readFame(basic.characterId), { fame, maxFame })
  }
  await recordCharacter(client, basic)
  assert.deepEqual(await readFame(basic.characterId), { fame: 0, maxFame: 70000 })
  await Promise.all(
    [90000, 80000].map((fame, index) =>
      recordCharacterBasic(client, { ...basic, adventureName: `합성동시모험단${index}`, fame })
    )
  )
  assert.equal((await readFame(basic.characterId)).maxFame, 90000)

  const withoutFame = { ...basic, characterId: 'max-fame-null-probe', fame: null }
  await recordCharacterBasic(client, withoutFame)
  assert.deepEqual(await readFame(withoutFame.characterId), { fame: null, maxFame: null })
  await recordCharacterBasic(client, { ...withoutFame, fame: 0 })
  assert.deepEqual(await readFame(withoutFame.characterId), { fame: 0, maxFame: 0 })
  await client.character.deleteMany({
    where: { serverId: 'cain', characterId: { in: [basic.characterId, withoutFame.characterId] } }
  })
  await client.adventure.deleteMany({
    where: { name: { in: [basic.adventureName, '합성동시모험단0', '합성동시모험단1'] } }
  })
} finally {
  await client.$disconnect()
}
