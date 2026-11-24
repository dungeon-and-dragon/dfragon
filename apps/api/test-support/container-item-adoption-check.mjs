import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readDatabaseConfiguration,
  readItemAdoption,
  readSetAdoption,
  recordCharacterBasic,
  recordCharacterSets,
  recordCharacterSkillStyle
} from '@dfragon/database'
import {
  StatsJobService,
  createItemAdoptionJob,
  createSetAdoptionJob
} from './dist/application/ranking-stats/stats-jobs.js'
import { DatabaseStatsJobRepository } from './dist/infrastructure/database/stats-jobs.js'

// 합성 캐릭터다. 앞 단계가 넣은 캐릭터도 있어, 전직을 고른 값은 이 검사의 전직으로만 비교하고 전체는 세트 통계와 비교한다.
// EARRING은 응답 부위 순서로는 SUPPORT 뒤지만 ID 순서로는 앞이라, 정렬 기준이 부위 ID로 바뀌면 실패한다.
// item-blade-e는 같은 무기 ID에 다른 이름과 모르는 종류를 붙여, 이름이 캐릭터가 많은 쪽으로 정해지는지 본다.
// Neople /df/jobs의 프리스트(남)와 眞 크루세이더 ID다.
const maleCrusader = {
  jobId: 'f6a4ad30555b99b499c07835f87ce522',
  jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
}
const blade = { jobId: 'synthetic-item-job', jobGrowId: 'synthetic-item-blade' }
const fetchedAt = new Date('2026-11-18T00:00:00Z')
const weapon = (itemId, itemName, typeDetail = '도') => ({
  slotId: 'WEAPON',
  itemId,
  itemName,
  typeDetail
})
const exalted = (slotId, itemId, itemName, typeDetail = null) => ({
  slotId,
  itemId,
  itemName,
  typeDetail
})
const basic = (characterId, job, fame) => ({
  serverId: 'cain',
  characterId,
  characterName: `합성${characterId}`,
  adventureName: '합성아이템모험단',
  level: 115,
  ...job,
  jobName: '합성직업',
  jobGrowName: '합성전직',
  fame,
  guildId: null,
  guildName: null
})
const ignoreProgress = { reportProgress: () => {} }
const sum = (items) => items.reduce((total, { count }) => total + count, 0)
const everyone = (query) => ({ ...query, sample: 'all' })
const slotOf = (adoption, slotId) => adoption.slots.find((slot) => slot.slotId === slotId)

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  const characters = [
    [
      'item-blade-a',
      blade,
      [weapon('item-weapon-a', '합성 무기'), exalted('SUPPORT', 'item-support-a', '합성 보조장비')]
    ],
    [
      'item-blade-b',
      blade,
      [weapon('item-weapon-a', '합성 무기'), exalted('EARRING', 'item-earring-a', '합성 귀걸이')]
    ],
    [
      'item-blade-c',
      blade,
      [weapon('item-weapon-b', '합성 다른 무기', '낫'), exalted('RING', 'item-ring-a', '합성 반지')]
    ],
    ['item-blade-d', blade, []],
    ['item-blade-e', blade, [weapon('item-weapon-a', '합성 무기 옛 이름', null)]],
    ['item-crusader-dealer', maleCrusader, [weapon('item-weapon-c', '합성 딜러 무기')]],
    ['item-crusader-buffer', maleCrusader, [weapon('item-weapon-d', '합성 버퍼 무기')]]
  ]

  for (const [index, [characterId, job, items]] of characters.entries()) {
    await recordCharacterBasic(client, basic(characterId, job, 90000 - index))
    await recordCharacterSets(client, {
      serverId: 'cain',
      characterId,
      equipmentSet: null,
      oathSet: null,
      items,
      fetchedAt
    })
  }

  await recordCharacterBasic(client, basic('item-blade-unfetched', blade, 80000))

  // 종류만 보는 전직이다. item-type-x는 모르는 종류가 더 많고, item-type-y는 아는 종류가 둘이다.
  const typed = { jobId: 'synthetic-item-job', jobGrowId: 'synthetic-item-typed' }

  for (const [index, [characterId, itemId, typeDetail]] of [
    ['item-typed-1', 'item-type-x', null],
    ['item-typed-2', 'item-type-x', null],
    ['item-typed-3', 'item-type-x', '창'],
    ['item-typed-4', 'item-type-y', '도'],
    ['item-typed-5', 'item-type-y', '낫'],
    ['item-typed-6', 'item-type-y', '낫']
  ].entries()) {
    await recordCharacterBasic(client, basic(characterId, typed, 70000 - index))
    await recordCharacterSets(client, {
      serverId: 'cain',
      characterId,
      equipmentSet: null,
      oathSet: null,
      items: [weapon(itemId, '합성 종류 무기', typeDetail)],
      fetchedAt
    })
  }

  for (const [characterId, skills] of [
    ['item-crusader-dealer', [{ name: '용기의 은총', level: 1 }]],
    ['item-crusader-buffer', [{ name: '합성버프', level: 20 }]]
  ]) {
    await recordCharacterSkillStyle(client, {
      serverId: 'cain',
      characterId,
      ...maleCrusader,
      skills,
      evolutions: [],
      enhancements: [],
      chain: null,
      fetchedAt
    })
  }

  const repository = new DatabaseStatsJobRepository(client)
  const service = new StatsJobService(repository)
  const job = createItemAdoptionJob(service)
  const startedAt = new Date()
  await job.run({}, ignoreProgress)
  await createSetAdoptionJob(service).run({}, ignoreProgress)

  const bladeAdoption = await readItemAdoption(client, everyone(blade))
  assert.ok(bladeAdoption.computedAt >= startedAt)
  assert.deepEqual(
    { ...bladeAdoption, computedAt: undefined },
    {
      computedAt: undefined,
      sampleSize: 5,
      slots: [
        {
          slotId: 'WEAPON',
          items: [
            { itemId: 'item-weapon-a', name: '합성 무기', typeDetail: '도', count: 3 },
            { itemId: 'item-weapon-b', name: '합성 다른 무기', typeDetail: '낫', count: 1 }
          ]
        },
        {
          slotId: 'RING',
          items: [{ itemId: 'item-ring-a', name: '합성 반지', typeDetail: null, count: 1 }]
        },
        {
          slotId: 'SUPPORT',
          items: [{ itemId: 'item-support-a', name: '합성 보조장비', typeDetail: null, count: 1 }]
        },
        {
          slotId: 'EARRING',
          items: [{ itemId: 'item-earring-a', name: '합성 귀걸이', typeDetail: null, count: 1 }]
        }
      ]
    }
  )
  assert.equal(sum(slotOf(bladeAdoption, 'WEAPON').items), 4)
  assert.equal(sum(slotOf(bladeAdoption, 'SUPPORT').items), 1)

  const dealer = await readItemAdoption(client, everyone({ ...maleCrusader, role: 'dealer' }))
  assert.deepEqual(slotOf(dealer, 'WEAPON').items, [
    { itemId: 'item-weapon-c', name: '합성 딜러 무기', typeDetail: '도', count: 1 }
  ])
  // 앞 단계가 세트 값을 남긴 남성 크루세이더도 표본 수에 들 수 있어, 역할은 이 검사의 무기로만 본다.
  const buffer = await readItemAdoption(client, everyone({ ...maleCrusader, role: 'buffer' }))
  assert.deepEqual(slotOf(buffer, 'WEAPON').items, [
    { itemId: 'item-weapon-d', name: '합성 버퍼 무기', typeDetail: '도', count: 1 }
  ])

  const typedAdoption = await readItemAdoption(client, everyone(typed))
  assert.deepEqual(slotOf(typedAdoption, 'WEAPON').items, [
    { itemId: 'item-type-x', name: '합성 종류 무기', typeDetail: '창', count: 3 },
    { itemId: 'item-type-y', name: '합성 종류 무기', typeDetail: '낫', count: 3 }
  ])

  // 아이템 상자는 세트 상자와 같은 표본을 센다.
  for (const query of [
    { sample: 'all' },
    { sample: 'fame' },
    { sample: 'top' },
    { ...blade, sample: 'top' },
    { jobId: blade.jobId, sample: 'top' },
    { ...maleCrusader, role: 'dealer', sample: 'top' }
  ]) {
    const items = await readItemAdoption(client, query)
    const sets = await readSetAdoption(client, query)
    assert.equal(items.sampleSize, sets.sampleSize, JSON.stringify(query))
  }

  const firstComputedAt = bladeAdoption.computedAt
  await recordCharacterSets(client, {
    serverId: 'cain',
    characterId: 'item-blade-b',
    equipmentSet: null,
    oathSet: null,
    items: [weapon('item-weapon-b', '합성 다른 무기', '낫')],
    fetchedAt: new Date('2026-11-18T01:00:00Z')
  })
  await job.run({}, ignoreProgress)
  const replaced = await readItemAdoption(client, everyone(blade))
  assert.deepEqual(slotOf(replaced, 'WEAPON').items, [
    { itemId: 'item-weapon-a', name: '합성 무기', typeDetail: '도', count: 2 },
    { itemId: 'item-weapon-b', name: '합성 다른 무기', typeDetail: '낫', count: 2 }
  ])
  assert.equal(slotOf(replaced, 'EARRING'), undefined)

  const [{ stale }] = await client.$queryRaw`
    SELECT count(*)::int AS stale FROM item_adoption WHERE computed_at <= ${firstComputedAt}`
  assert.equal(stale, 0)

  await assert.rejects(
    client.$executeRaw`
      INSERT INTO item_adoption (job_id, job_grow_id, role, sample, count, computed_at)
      VALUES (${blade.jobId}, ${blade.jobGrowId}, 'all', 'top', 1, now())`,
    /item_adoption_sample_check/
  )

  // 넣는 문장이 실패하게 해 교체 transaction이 이전 저장분을 남기는지 본다.
  await client.$executeRaw`ALTER TABLE item_adoption ADD CONSTRAINT synthetic_failure CHECK (count < 0) NOT VALID`

  try {
    await assert.rejects(job.run({}, ignoreProgress))
  } finally {
    await client.$executeRaw`ALTER TABLE item_adoption DROP CONSTRAINT synthetic_failure`
  }

  assert.deepEqual(await readItemAdoption(client, everyone(blade)), replaced)
} finally {
  await client.$disconnect()
}
