import { createDatabaseClient, readDatabaseConfiguration, recordCharacter } from '@dfragon/database'

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
} finally {
  await client.$disconnect()
}
