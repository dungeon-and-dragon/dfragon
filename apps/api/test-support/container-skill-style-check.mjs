import {
  createDatabaseClient,
  readDatabaseConfiguration,
  recordCharacterBasic,
  recordCharacterSkillStyle
} from '@dfragon/database'

// 합성 캐릭터다. 두 캐릭터의 스킬 스타일을 넣은 뒤 한 캐릭터만 새로 받은 값과 예전에 받은 값으로 다시 저장한다.
const basic = (characterId) => ({
  serverId: 'cain',
  characterId,
  characterName: `합성${characterId}`,
  adventureName: '합성스킬모험단',
  level: 115,
  jobId: 'synthetic-skill-job',
  jobGrowId: 'synthetic-skill-grow',
  jobName: '합성직업',
  jobGrowName: '합성전직',
  fame: 70000,
  guildId: null,
  guildName: null
})
const style = (characterId, skill, level, fetchedAt) => ({
  serverId: 'cain',
  characterId,
  jobId: 'synthetic-skill-job',
  jobGrowId: 'synthetic-skill-grow',
  skills: [{ name: skill, level }],
  evolutions: [{ name: skill, type: 1 }],
  enhancements: [{ name: skill, type: 2 }],
  fetchedAt: new Date(fetchedAt)
})

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  await recordCharacterBasic(client, basic('skill-a'))
  await recordCharacterBasic(client, basic('skill-b'))
  await recordCharacterSkillStyle(client, style('skill-a', '합성A', 1, '2026-11-01T00:00:00Z'))
  await recordCharacterSkillStyle(client, style('skill-b', '합성B', 1, '2026-11-01T00:00:00Z'))
  await recordCharacterSkillStyle(client, style('skill-a', '합성A2', 13, '2026-11-07T00:00:00Z'))
  await recordCharacterSkillStyle(client, style('skill-a', '합성A1', 5, '2026-11-03T00:00:00Z'))
} finally {
  await client.$disconnect()
}
