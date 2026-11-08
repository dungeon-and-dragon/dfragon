import assert from 'node:assert/strict'
import {
  SKILL_STYLE_SAMPLE_TOP_COUNT,
  createDatabaseClient,
  readDatabaseConfiguration,
  readJobSkillAdoption,
  recordCharacterBasic,
  recordCharacterSkillStyle
} from '@dfragon/database'

// 합성 캐릭터다. 한 전직에 명성 있는 캐릭터 5018명을 두어 상위 5000명이 표본이 된다.
// adopt-19가 정확히 5000위라 경계의 캐릭터가 표본에 드는지 확인한다.
const jobId = 'synthetic-adopt-job'
const jobGrowId = 'synthetic-adopt-grow'
const job = { jobId, jobGrowId }
const fetchedAt = new Date('2026-11-07T00:00:00Z')
const basic = (characterId, fame, grow = jobGrowId) => ({
  serverId: 'cain',
  characterId,
  characterName: `합성${characterId}`,
  adventureName: '합성채택모험단',
  level: 115,
  jobId,
  jobGrowId: grow,
  jobName: '합성직업',
  jobGrowName: `합성${grow}`,
  fame,
  guildId: null,
  guildName: null
})
const style = (characterId, { grow = jobGrowId, skills, evolutions = [], enhancements = [] }) => ({
  serverId: 'cain',
  characterId,
  jobId,
  jobGrowId: grow,
  skills,
  evolutions,
  enhancements,
  fetchedAt
})
const learnedAll = {
  skills: [
    { name: '발도', level: 13 },
    { name: '류심', level: 1 }
  ],
  evolutions: [{ name: '발도', type: 1 }],
  enhancements: [{ name: '발도', type: 2 }]
}

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  assert.deepEqual(await readJobSkillAdoption(client, job), {
    minFame: null,
    sampleSize: 0,
    skills: [],
    evolutions: [],
    enhancements: []
  })

  for (let index = 1; index <= SKILL_STYLE_SAMPLE_TOP_COUNT - 3; index++) {
    await recordCharacterBasic(client, basic(`adopt-filler-${index}`, 300000 + index))
  }
  for (let index = 1; index <= 21; index++) {
    await recordCharacterBasic(client, basic(`adopt-${index}`, 100000 + index))
  }
  await recordCharacterBasic(client, basic('adopt-no-fame', null))
  await recordCharacterBasic(
    client,
    basic('adopt-other-grow', 200000, 'synthetic-adopt-other-grow')
  )
  await recordCharacterSkillStyle(client, style('adopt-21', learnedAll))
  await recordCharacterSkillStyle(
    client,
    style('adopt-19', {
      skills: [{ name: '발도', level: 1 }],
      evolutions: [{ name: '발도', type: 2 }],
      enhancements: [{ name: '발도', type: 2 }]
    })
  )
  // 표본 안이지만 받을 때의 전직이 지금과 다르다.
  await recordCharacterSkillStyle(
    client,
    style('adopt-20', { ...learnedAll, grow: 'synthetic-adopt-old-grow' })
  )
  // 표본 밖, 명성 없는 캐릭터, 다른 전직 캐릭터다.
  await recordCharacterSkillStyle(client, style('adopt-18', learnedAll))
  await recordCharacterSkillStyle(client, style('adopt-no-fame', learnedAll))
  await recordCharacterSkillStyle(
    client,
    style('adopt-other-grow', { ...learnedAll, grow: 'synthetic-adopt-other-grow' })
  )

  const expected = {
    minFame: 100019,
    sampleSize: 2,
    skills: [
      { name: '류심', learned: 1, levels: [[1, 1]] },
      {
        name: '발도',
        learned: 2,
        levels: [
          [1, 1],
          [13, 1]
        ]
      }
    ],
    evolutions: [{ name: '발도', type1: 1, type2: 1 }],
    enhancements: [{ name: '발도', type1: 0, type2: 2 }]
  }
  assert.deepEqual(await readJobSkillAdoption(client, job), expected)

  const get = async () => {
    const response = await fetch(
      new URL(`/stats/skills?jobId=${jobId}&jobGrowId=${jobGrowId}`, 'http://127.0.0.1:3000')
    )
    assert.equal(response.status, 200)

    return response.json()
  }
  const answer = await get()
  assert.deepEqual(
    { ...answer, computedAt: undefined },
    { computedAt: undefined, topCount: SKILL_STYLE_SAMPLE_TOP_COUNT, ...expected }
  )
  await recordCharacterSkillStyle(client, style('adopt-20', learnedAll))
  assert.deepEqual(await get(), answer)
} finally {
  await client.$disconnect()
}
