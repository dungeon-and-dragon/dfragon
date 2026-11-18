import { storedDealerSkillLearnedSql } from './adventure-guild.js'
import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'
import type { MaleCrusaderRole } from './male-crusader.js'

export type SetAdoptionJob = {
  jobId: string
  jobGrowId: string
}

export type SetAdoptionReplacement = {
  computedAt: Date
  maleCrusader: SetAdoptionJob
}

export type SetAdoptionQuery = {
  jobId?: string
  jobGrowId?: string
  role?: MaleCrusaderRole
}

export type EquipmentSetCount = {
  setId: string | null
  name: string | null
  count: number
}

export type OathOptionCount = {
  name: string | null
  count: number
}

export type OathSetCount = {
  setId: number | null
  name: string | null
  count: number
  options: OathOptionCount[]
}

export type SetComboCount = {
  equipmentSetId: string | null
  oathSetId: number | null
  count: number
}

export type SetAdoption = {
  computedAt: Date | null
  sampleSize: number
  equipmentSets: EquipmentSetCount[]
  oathSets: OathSetCount[]
  combos: SetComboCount[]
}

// 운영 크기 합성 데이터(세트를 받은 캐릭터 100만 명, PostgreSQL 18.7)에서 교체 transaction이 2~3초 걸렸다.
// 운영 장비와 설정 차이를 감안해 Prisma 기본값 5초보다 넉넉히 둔다.
const REPLACE_TIMEOUT_MS = 60_000

// 한 transaction에서 지우고 넣어, 집계가 실패하면 이전 저장분이 남는다.
export async function replaceSetAdoption(
  client: DatabaseClient,
  { computedAt, maleCrusader }: SetAdoptionReplacement
): Promise<number> {
  // 남성 크루세이더만 랭킹과 같은 스킬 스타일 판정으로 역할을 나누고, 판정할 행이 없으면 unknown이다.
  const role = Prisma.sql`CASE
    WHEN c.job_id = ${maleCrusader.jobId} AND c.job_grow_id = ${maleCrusader.jobGrowId} THEN
      CASE ${storedDealerSkillLearnedSql} WHEN true THEN 'dealer' WHEN false THEN 'buffer' ELSE 'unknown' END
    ELSE 'all'
  END`

  // TRUNCATE는 commit까지 읽기도 막으므로, 계산하는 동안 API가 이전 저장분을 읽도록 DELETE로 지운다.

  return client.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`DELETE FROM set_adoption`

      return transaction.$executeRaw`
        INSERT INTO set_adoption
          (job_id, job_grow_id, role, equipment_set_id, equipment_set_name,
           oath_set_id, oath_set_name, oath_set_option, count, computed_at)
        SELECT c.job_id, c.job_grow_id, ${role}, c.equipment_set_id, c.equipment_set_name,
          c.oath_set_id, c.oath_set_name, c.oath_set_option, count(*)::int, ${computedAt}
        FROM characters c
        WHERE c.sets_fetched_at IS NOT NULL AND c.job_id IS NOT NULL AND c.job_grow_id IS NOT NULL
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`
    },
    { timeout: REPLACE_TIMEOUT_MS }
  )
}

function setAdoptionConditions({ jobId, jobGrowId, role }: SetAdoptionQuery): Prisma.Sql {
  const conditions = [
    ...(jobId !== undefined ? [Prisma.sql`job_id = ${jobId}`] : []),
    ...(jobGrowId !== undefined ? [Prisma.sql`job_grow_id = ${jobGrowId}`] : []),
    ...(role !== undefined ? [Prisma.sql`role = ${role}`] : [])
  ]

  if (conditions.length === 0) {
    return Prisma.empty
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
}

// 같은 세트 id에 이름이 여럿이면 캐릭터가 가장 많은 이름을 준다. 목록은 수가 많은 순이고 같으면 id 순이다.
// 한 문장으로 읽어 job이 표를 바꾸는 중에도 세 목록과 표본 수가 같은 저장분에서 나온다.
export async function readSetAdoption(
  client: DatabaseClient,
  query: SetAdoptionQuery
): Promise<SetAdoption> {
  const [adoption] = await client.$queryRaw<SetAdoption[]>`
    WITH picked AS (
      SELECT * FROM set_adoption ${setAdoptionConditions(query)}
    ),
    equipment_names AS (
      SELECT equipment_set_id AS id, equipment_set_name AS name, sum(count)::int AS count
      FROM picked GROUP BY 1, 2
    ),
    equipment_sets AS (
      SELECT id, (array_agg(name ORDER BY count DESC, name))[1] AS name, sum(count)::int AS count
      FROM equipment_names GROUP BY id
    ),
    oath_names AS (
      SELECT oath_set_id AS id, oath_set_name AS name, sum(count)::int AS count
      FROM picked GROUP BY 1, 2
    ),
    oath_options AS (
      SELECT oath_set_id AS id, oath_set_option AS name, sum(count)::int AS count
      FROM picked GROUP BY 1, 2
    ),
    oath_sets AS (
      SELECT names.id, names.name, names.count, (
        SELECT jsonb_agg(jsonb_build_object('name', option.name, 'count', option.count)
          ORDER BY option.count DESC, option.name)
        FROM oath_options option
        WHERE option.id IS NOT DISTINCT FROM names.id
      ) AS options
      FROM (
        SELECT id, (array_agg(name ORDER BY count DESC, name))[1] AS name, sum(count)::int AS count
        FROM oath_names GROUP BY id
      ) names
    ),
    combos AS (
      SELECT equipment_set_id, oath_set_id, sum(count)::int AS count
      FROM picked GROUP BY 1, 2
    )
    SELECT
      (SELECT max(computed_at) FROM set_adoption) AS "computedAt",
      (SELECT COALESCE(sum(count), 0)::int FROM picked) AS "sampleSize",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('setId', id, 'name', name, 'count', count)
          ORDER BY count DESC, id), '[]'::jsonb)
        FROM equipment_sets
      ) AS "equipmentSets",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('setId', id, 'name', name, 'count', count, 'options', options)
          ORDER BY count DESC, id), '[]'::jsonb)
        FROM oath_sets
      ) AS "oathSets",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('equipmentSetId', equipment_set_id, 'oathSetId', oath_set_id, 'count', count)
          ORDER BY count DESC, equipment_set_id, oath_set_id), '[]'::jsonb)
        FROM combos
      ) AS combos`

  return adoption
}
