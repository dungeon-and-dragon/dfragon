import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readDatabaseConfiguration,
  readFameRanking,
  readJobSkillAdoption,
  recordCharacterBasic,
  recordCharacterSkillStyle,
  saveJobSkillAdoption
} from '@dfragon/database'

// 합성 캐릭터다. 직업, 전직 ID는 Neople /df/jobs의 프리스트(남), 프리스트(여)와 眞 크루세이더다.
const maleJob = { jobId: 'f6a4ad30555b99b499c07835f87ce522', jobName: '프리스트(남)' }
const femaleJob = { jobId: '0c1b401bb09241570d364420b3ba3fd7', jobName: '프리스트(여)' }
const crusaderGrowId = '37495b941da3b1661bc900e68ef3b2c6'
const infighterGrowId = '618326026de1a1f1cfba5dbd0b8396e7'
const maleCrusader = { jobId: maleJob.jobId, jobGrowId: crusaderGrowId }
const adventureName = '합성크루세이더모험단'
const guildId = 'synthetic-crusader-guild'
const fetchedAt = new Date('2026-11-09T00:00:00Z')
const basic = (characterId, fame, { jobId, jobName } = maleJob) => ({
  serverId: 'cain',
  characterId,
  characterName: `합성${characterId}`,
  adventureName,
  level: 115,
  jobId,
  jobGrowId: crusaderGrowId,
  jobName,
  jobGrowName: '眞 크루세이더',
  fame,
  guildId,
  guildName: '합성크루세이더길드'
})
const style = (
  characterId,
  skills,
  { jobId = maleJob.jobId, jobGrowId = crusaderGrowId } = {}
) => ({
  serverId: 'cain',
  characterId,
  jobId,
  jobGrowId,
  skills,
  evolutions: [],
  enhancements: [],
  fetchedAt
})
const dealerSkills = (courageLevel) => [
  { name: '용기의 은총', level: courageLevel },
  { name: '성령의 메이스', level: 20 }
]
const bufferSkills = [
  { name: '영광의 축복', level: 30 },
  { name: '성령의 메이스', level: 1 }
]
const ids = (rows) => rows.map(({ characterId }) => characterId)

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  for (const character of [
    basic('mc-dealer-1', 300000),
    basic('mc-no-style', 295000),
    basic('mc-buffer', 290000),
    basic('mc-old-grow', 285000),
    basic('mc-dealer-2', 280000),
    basic('mc-no-fame', null),
    basic('fc-courage', 310000, femaleJob)
  ]) {
    await recordCharacterBasic(client, character)
  }
  await recordCharacterSkillStyle(client, style('mc-dealer-1', dealerSkills(10)))
  await recordCharacterSkillStyle(client, style('mc-buffer', bufferSkills))
  // 인파이터일 때 받은 행이라 지금 전직의 역할로 쓰지 않는다.
  await recordCharacterSkillStyle(
    client,
    style('mc-old-grow', dealerSkills(10), { jobGrowId: infighterGrowId })
  )
  await recordCharacterSkillStyle(client, style('mc-dealer-2', dealerSkills(1)))
  await recordCharacterSkillStyle(client, style('mc-no-fame', bufferSkills))
  await recordCharacterSkillStyle(
    client,
    style('fc-courage', dealerSkills(10), { jobId: femaleJob.jobId })
  )

  const all = await readFameRanking(client, maleCrusader, 100)
  assert.deepEqual(
    all.map(({ characterId, dealerSkillLearned }) => [characterId, dealerSkillLearned]),
    [
      ['mc-dealer-1', true],
      ['mc-no-style', null],
      ['mc-buffer', false],
      ['mc-old-grow', null],
      ['mc-dealer-2', true]
    ]
  )
  assert.deepEqual(ids(await readFameRanking(client, { ...maleCrusader, role: 'dealer' }, 100)), [
    'mc-dealer-1',
    'mc-dealer-2'
  ])
  assert.deepEqual(ids(await readFameRanking(client, { ...maleCrusader, role: 'buffer' }, 100)), [
    'mc-buffer'
  ])
  assert.deepEqual(ids(await readFameRanking(client, { ...maleCrusader, role: 'dealer' }, 1)), [
    'mc-dealer-1'
  ])

  const dealerAdoption = {
    minFame: 280000,
    sampleSize: 2,
    skills: [
      {
        name: '용기의 은총',
        learned: 2,
        levels: [
          [1, 1],
          [10, 1]
        ]
      },
      { name: '성령의 메이스', learned: 2, levels: [[20, 2]] }
    ],
    evolutions: [],
    enhancements: []
  }
  const bufferAdoption = {
    minFame: 280000,
    sampleSize: 1,
    skills: [
      { name: '영광의 축복', learned: 1, levels: [[30, 1]] },
      { name: '성령의 메이스', learned: 1, levels: [[1, 1]] }
    ],
    evolutions: [],
    enhancements: []
  }
  assert.deepEqual(
    await readJobSkillAdoption(client, { ...maleCrusader, role: 'dealer' }),
    dealerAdoption
  )
  assert.deepEqual(
    await readJobSkillAdoption(client, { ...maleCrusader, role: 'buffer' }),
    bufferAdoption
  )
  const allAdoption = await readJobSkillAdoption(client, maleCrusader)
  assert.deepEqual([allAdoption.minFame, allAdoption.sampleSize], [280000, 3])

  // 같은 컨테이너에서 DB 설정으로 뜬 API를 불러 query 검사, 응답 행의 role과 role별 저장분 읽기를 확인한다.
  const request = (path) => fetch(new URL(path, 'http://127.0.0.1:3000'))
  const get = async (path) => {
    const response = await request(path)
    assert.equal(response.status, 200, path)

    return response.json()
  }
  const roles = (rows) => rows.map(({ characterId, role }) => [characterId, role])
  const maleQuery = `jobId=${maleCrusader.jobId}&jobGrowId=${crusaderGrowId}`

  assert.deepEqual(roles((await get(`/rankings/fame?${maleQuery}`)).characters), [
    ['mc-dealer-1', 'dealer'],
    ['mc-no-style', null],
    ['mc-buffer', 'buffer'],
    ['mc-old-grow', null],
    ['mc-dealer-2', 'dealer']
  ])
  assert.deepEqual(
    (await get(`/rankings/fame?${maleQuery}&role=dealer`)).characters.map(
      ({ rank, characterId, role }) => [rank, characterId, role]
    ),
    [
      [1, 'mc-dealer-1', 'dealer'],
      [2, 'mc-dealer-2', 'dealer']
    ]
  )
  assert.deepEqual(roles((await get(`/rankings/fame?${maleQuery}&role=buffer`)).characters), [
    ['mc-buffer', 'buffer']
  ])
  const femaleQuery = `jobId=${femaleJob.jobId}&jobGrowId=${crusaderGrowId}&role=dealer`
  for (const path of [`/rankings/fame?${femaleQuery}`, `/stats/skills?${femaleQuery}`]) {
    const response = await request(path)
    assert.equal(response.status, 400, path)
    assert.equal((await response.json()).error.code, 'INVALID_CHARACTER_QUERY', path)
  }

  const expectedRowRoles = [
    ['fc-courage', 'buffer'],
    ['mc-dealer-1', 'dealer'],
    ['mc-no-style', null],
    ['mc-buffer', 'buffer'],
    ['mc-old-grow', null],
    ['mc-dealer-2', 'dealer'],
    ['mc-no-fame', 'buffer']
  ]
  const adventure = await get(`/adventures/${encodeURIComponent(adventureName)}/characters`)
  assert.deepEqual(roles(adventure.characters), expectedRowRoles)
  assert.equal('dealerSkillLearned' in adventure.characters[0], false)
  assert.deepEqual(roles((await get(`/guilds/${guildId}`)).members), expectedRowRoles)
  assert.deepEqual(
    roles((await get(`/adventures/${encodeURIComponent(adventureName)}/weekly`)).characters),
    expectedRowRoles
  )

  const computedAt = new Date('2026-11-09T15:00:00.000Z')
  for (const [role, adoption] of [
    ['dealer', dealerAdoption],
    ['buffer', bufferAdoption],
    [undefined, allAdoption]
  ]) {
    await saveJobSkillAdoption(client, { ...maleCrusader, role, computedAt, adoption })
  }
  const skillStats = async (query) => {
    const {
      computedAt: _computedAt,
      topCount: _topCount,
      ...adoption
    } = await get(`/stats/skills?${query}`)

    return adoption
  }
  assert.deepEqual(await skillStats(`${maleQuery}&role=dealer`), dealerAdoption)
  assert.deepEqual(await skillStats(`${maleQuery}&role=buffer`), bufferAdoption)
  assert.deepEqual(await skillStats(maleQuery), allAdoption)
} finally {
  await client.$disconnect()
}
