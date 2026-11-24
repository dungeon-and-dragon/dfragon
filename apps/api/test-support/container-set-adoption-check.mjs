import assert from 'node:assert/strict'
import { SET_SAMPLE_TOP_COUNT } from '@dfragon/lib'
import {
  createDatabaseClient,
  readDatabaseConfiguration,
  readSetAdoption,
  recordCharacterBasic,
  recordCharacterSets,
  recordCharacterSkillStyle
} from '@dfragon/database'
import {
  StatsJobService,
  createSetAdoptionJob
} from './dist/application/ranking-stats/stats-jobs.js'
import { DatabaseStatsJobRepository } from './dist/infrastructure/database/stats-jobs.js'

// 합성 캐릭터다. 앞 단계가 넣은 캐릭터도 있어, 전직을 고른 값은 이 검사의 전직으로만 비교하고 전체는 합으로 비교한다.
// Neople /df/jobs의 프리스트(남)와 眞 크루세이더 ID다.
const maleCrusader = {
  jobId: 'f6a4ad30555b99b499c07835f87ce522',
  jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
}
const blade = { jobId: 'synthetic-set-job', jobGrowId: 'synthetic-set-blade' }
// 명성 상위 표본의 경계를 보는 직업이다. crowded 전직의 가장 낮은 캐릭터와 lone 전직의 캐릭터는 직업 안의 상위 500명에서 빠진다.
const topJob = 'synthetic-set-top-job'
const crowded = { jobId: topJob, jobGrowId: 'synthetic-set-crowded' }
const lone = { jobId: topJob, jobGrowId: 'synthetic-set-lone' }
const everyone = (query) => ({ ...query, sample: 'all' })
const fetchedAt = new Date('2026-11-18T00:00:00Z')
const fairy = { id: 'set-fairy', name: '소울 페어리 세트' }
const golden = { id: 'set-golden', name: '영원히 이어지는 황금향 세트' }
const dragon = (option) => ({ id: 16204, name: '야망의 용투 서약', option })
const basic = (characterId, job, fame) => ({
  serverId: 'cain',
  characterId,
  characterName: `합성${characterId}`,
  adventureName: '합성세트모험단',
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

const client = createDatabaseClient(readDatabaseConfiguration(process.env))

try {
  const characters = [
    ['set-blade-a', blade, fairy, dragon('용투 : 세계를 태우는 불꽃')],
    ['set-blade-b', blade, fairy, dragon('용투 : 합성 선택지')],
    ['set-blade-c', blade, golden, null],
    ['set-blade-d', blade, null, null],
    ['set-crusader-dealer', maleCrusader, fairy, dragon('용투 : 세계를 태우는 불꽃')],
    ['set-crusader-buffer', maleCrusader, golden, dragon('용투 : 세계를 태우는 불꽃')],
    ['set-crusader-unknown', maleCrusader, golden, null]
  ]

  for (const [index, [characterId, job, equipmentSet, oathSet]] of characters.entries()) {
    await recordCharacterBasic(client, basic(characterId, job, 90000 - index))
    await recordCharacterSets(client, {
      serverId: 'cain',
      characterId,
      equipmentSet,
      oathSet,
      items: [],
      fetchedAt
    })
  }

  await recordCharacterBasic(client, basic('set-blade-unfetched', blade, 80000))

  // 상위 500명 경계에는 501명이 필요해 한 문장으로 넣는다. crowded의 명성은 117001부터 117501까지라 117014 이상이 488명이다.
  await client.$executeRaw`
    WITH adventure AS (INSERT INTO adventures (name) VALUES ('합성표본모험단') RETURNING id)
    INSERT INTO characters (server_id, character_id, character_name, adventure_id, job_id, job_grow_id, fame,
      equipment_set_id, equipment_set_name, sets_fetched_at)
    SELECT 'cain', 'set-crowded-' || rank, '합성표본' || rank, adventure.id, ${crowded.jobId}, ${crowded.jobGrowId},
      117000 + rank, CASE WHEN rank = 1 THEN 'set-low' ELSE 'set-top' END,
      CASE WHEN rank = 1 THEN '합성 낮은 세트' ELSE '합성 상위 세트' END, ${fetchedAt}::timestamptz
    FROM adventure, generate_series(1, ${SET_SAMPLE_TOP_COUNT + 1}) rank
    UNION ALL
    SELECT 'cain', 'set-lone', '합성외톨이', adventure.id, ${lone.jobId}, ${lone.jobGrowId}, 117000,
      'set-lone', '합성 외톨이 세트', ${fetchedAt}::timestamptz
    FROM adventure`

  for (const [characterId, skills] of [
    ['set-crusader-dealer', [{ name: '용기의 은총', level: 1 }]],
    ['set-crusader-buffer', [{ name: '합성버프', level: 20 }]]
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
  const job = createSetAdoptionJob(new StatsJobService(repository))
  const startedAt = new Date()
  await job.run({}, ignoreProgress)

  const bladeAdoption = await readSetAdoption(client, everyone(blade))
  assert.ok(bladeAdoption.computedAt >= startedAt)
  assert.deepEqual(
    { ...bladeAdoption, computedAt: undefined },
    {
      computedAt: undefined,
      sampleSize: 4,
      equipmentSets: [
        { setId: 'set-fairy', name: '소울 페어리 세트', count: 2 },
        { setId: 'set-golden', name: '영원히 이어지는 황금향 세트', count: 1 },
        { setId: null, name: null, count: 1 }
      ],
      oathSets: [
        {
          setId: 16204,
          name: '야망의 용투 서약',
          count: 2,
          options: [
            { name: '용투 : 세계를 태우는 불꽃', count: 1 },
            { name: '용투 : 합성 선택지', count: 1 }
          ]
        },
        {
          setId: null,
          name: null,
          count: 2,
          options: [{ name: null, count: 2 }]
        }
      ],
      combos: [
        { equipmentSetId: 'set-fairy', oathSetId: 16204, count: 2 },
        { equipmentSetId: 'set-golden', oathSetId: null, count: 1 },
        { equipmentSetId: null, oathSetId: null, count: 1 }
      ]
    }
  )

  const crusader = await readSetAdoption(client, everyone(maleCrusader))
  const dealer = await readSetAdoption(client, everyone({ ...maleCrusader, role: 'dealer' }))
  const buffer = await readSetAdoption(client, everyone({ ...maleCrusader, role: 'buffer' }))
  assert.deepEqual(dealer.equipmentSets, [
    { setId: 'set-fairy', name: '소울 페어리 세트', count: 1 }
  ])
  assert.deepEqual(buffer.equipmentSets, [
    { setId: 'set-golden', name: '영원히 이어지는 황금향 세트', count: 1 }
  ])
  // 스킬 스타일이 없는 캐릭터는 어느 역할에도 들지 않고 unknown으로 전직 전체에만 든다.
  // 앞 단계가 세트 값을 남긴 남성 크루세이더가 있을 수 있어, 이 검사의 세트 조합 행으로만 역할을 본다.
  const roles = await client.$queryRaw`
    SELECT job_grow_id AS "jobGrowId", role, sum(count)::int AS count
    FROM set_adoption
    WHERE sample = 'all' AND ((job_grow_id = ${blade.jobGrowId})
      OR (job_grow_id = ${maleCrusader.jobGrowId} AND equipment_set_id IN ('set-fairy', 'set-golden')))
    GROUP BY 1, 2
    ORDER BY 1, 2`
  assert.deepEqual(roles, [
    { jobGrowId: maleCrusader.jobGrowId, role: 'buffer', count: 1 },
    { jobGrowId: maleCrusader.jobGrowId, role: 'dealer', count: 1 },
    { jobGrowId: maleCrusader.jobGrowId, role: 'unknown', count: 1 },
    { jobGrowId: blade.jobGrowId, role: 'all', count: 4 }
  ])
  assert.equal(dealer.sampleSize, 1)
  assert.equal(buffer.sampleSize, 1)

  for (const adoption of [bladeAdoption, crusader, dealer, buffer]) {
    assert.equal(sum(adoption.equipmentSets), adoption.sampleSize)
    assert.equal(sum(adoption.oathSets), adoption.sampleSize)
    assert.equal(sum(adoption.combos), adoption.sampleSize)
    for (const oathSet of adoption.oathSets) {
      assert.equal(sum(oathSet.options), oathSet.count)
    }
  }

  const jobGrows = await client.$queryRaw`
    SELECT DISTINCT job_id AS "jobId", job_grow_id AS "jobGrowId" FROM set_adoption`
  const total = await readSetAdoption(client, everyone({}))
  const perJobGrow = await Promise.all(
    jobGrows.map((jobGrow) => readSetAdoption(client, everyone(jobGrow)))
  )
  const perJobGrowTotal = sum(perJobGrow.map(({ sampleSize }) => ({ count: sampleSize })))
  assert.equal(total.sampleSize, perJobGrowTotal)

  const firstComputedAt = bladeAdoption.computedAt
  await recordCharacterSets(client, {
    serverId: 'cain',
    characterId: 'set-blade-c',
    equipmentSet: fairy,
    oathSet: null,
    items: [],
    fetchedAt: new Date('2026-11-18T01:00:00Z')
  })
  await job.run({}, ignoreProgress)
  const replaced = await readSetAdoption(client, everyone(blade))
  assert.deepEqual(replaced.equipmentSets, [
    { setId: 'set-fairy', name: '소울 페어리 세트', count: 3 },
    { setId: null, name: null, count: 1 }
  ])
  const [{ stale }] = await client.$queryRaw`
    SELECT count(*)::int AS stale FROM set_adoption WHERE computed_at <= ${firstComputedAt}`

  assert.equal(stale, 0)

  const equipmentOf = async (query) => (await readSetAdoption(client, query)).equipmentSets
  const topSet = (count) => ({ setId: 'set-top', name: '합성 상위 세트', count })
  const lowSet = { setId: 'set-low', name: '합성 낮은 세트', count: 1 }
  const loneSet = { setId: 'set-lone', name: '합성 외톨이 세트', count: 1 }
  assert.deepEqual(await equipmentOf(everyone(crowded)), [topSet(500), lowSet])
  assert.deepEqual(await equipmentOf({ ...crowded, sample: 'top' }), [topSet(500)])
  assert.deepEqual(await equipmentOf({ ...lone, sample: 'top' }), [loneSet])
  assert.deepEqual(await equipmentOf({ jobId: topJob, sample: 'top' }), [topSet(500)])
  assert.deepEqual(await equipmentOf({ jobId: topJob, sample: 'fame' }), [topSet(488)])
  assert.equal((await readSetAdoption(client, { sample: 'top' })).sampleSize, SET_SAMPLE_TOP_COUNT)
  // blade의 명성은 crowded보다 낮아 전체 상위 500명에는 없지만, 직업 안의 상위로는 모두 든다.
  assert.equal(
    (await readSetAdoption(client, { jobId: blade.jobId, sample: 'top' })).sampleSize,
    bladeAdoption.sampleSize
  )

  // 남성 크루세이더는 500명보다 적어, 전직과 역할의 상위 표본이 전체 표본과 같다.
  assert.equal(
    (await readSetAdoption(client, { ...maleCrusader, sample: 'top' })).sampleSize,
    crusader.sampleSize
  )
  assert.deepEqual(
    await equipmentOf({ ...maleCrusader, role: 'dealer', sample: 'top' }),
    dealer.equipmentSets
  )
  await assert.rejects(
    client.$executeRaw`
      INSERT INTO set_adoption (job_id, job_grow_id, role, sample, count, computed_at)
      VALUES (${blade.jobId}, ${blade.jobGrowId}, 'all', 'top', 1, now())`,
    /set_adoption_sample_check/
  )

  // 넣는 문장이 실패하게 해 교체 transaction이 이전 저장분을 남기는지 본다.
  await client.$executeRaw`ALTER TABLE set_adoption ADD CONSTRAINT synthetic_failure CHECK (count < 0) NOT VALID`

  try {
    await assert.rejects(job.run({}, ignoreProgress))
  } finally {
    await client.$executeRaw`ALTER TABLE set_adoption DROP CONSTRAINT synthetic_failure`
  }

  assert.deepEqual(await readSetAdoption(client, everyone(blade)), replaced)
} finally {
  await client.$disconnect()
}
