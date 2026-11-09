import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'
import {
  type MaleCrusaderRole,
  learnedDealerSkillSql,
  maleCrusaderRoleSql
} from './male-crusader.js'
import { type SkillStyleSampleJob, skillStyleSampleSql } from './skill-style-sample.js'

export type SkillLevelCount = [level: number, count: number]

export type SkillAdoption = {
  name: string
  learned: number
  levels: SkillLevelCount[]
}

export type SkillSelectionCount = {
  name: string
  type1: number
  type2: number
}

export type JobSkillAdoptionQuery = SkillStyleSampleJob & {
  role?: MaleCrusaderRole
}

export type JobSkillAdoption = {
  minFame: number | null
  sampleSize: number
  skills: SkillAdoption[]
  evolutions: SkillSelectionCount[]
  enhancements: SkillSelectionCount[]
}

function selectionCountsSql(column: 'evolutions' | 'enhancements'): Prisma.Sql {
  const selections = Prisma.raw(column)

  return Prisma.sql`
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'type1', type1, 'type2', type2) ORDER BY name), '[]'::jsonb)
    FROM (
      SELECT selection->>'name' AS name,
        count(*) FILTER (WHERE (selection->>'type')::int = 1)::int AS type1,
        count(*) FILTER (WHERE (selection->>'type')::int = 2)::int AS type2
      FROM styles CROSS JOIN jsonb_array_elements(styles.${selections}) AS selection
      GROUP BY 1
    ) counted`
}

export async function readJobSkillAdoption(
  client: DatabaseClient,
  { role, ...job }: JobSkillAdoptionQuery
): Promise<JobSkillAdoption> {
  const roleCondition =
    role !== undefined
      ? Prisma.sql`AND ${maleCrusaderRoleSql(learnedDealerSkillSql(Prisma.sql`style.skills`), role)}`
      : Prisma.empty

  // 전직을 바꾼 뒤 아직 다시 받지 않은 캐릭터는 예전 전직의 스킬이 남아 있어 뺀다.
  // FROM 없는 바깥 SELECT라 표본이 비어도 한 행이 나온다.
  const [adoption] = await client.$queryRaw<JobSkillAdoption[]>`
    WITH sample AS (${skillStyleSampleSql(job)}),
    styles AS (
      SELECT style.skills, style.evolutions, style.enhancements
      FROM sample
      JOIN character_skill_styles style
        ON style.server_id = sample.server_id
        AND style.character_id = sample.character_id
        AND style.job_id = ${job.jobId}
        AND style.job_grow_id = ${job.jobGrowId}
        ${roleCondition}
    ),
    skill_levels AS (
      SELECT skill->>'name' AS name, (skill->>'level')::int AS level, count(*)::int AS count
      FROM styles CROSS JOIN jsonb_array_elements(styles.skills) AS skill
      GROUP BY 1, 2
    )
    SELECT
      (SELECT min(fame) FROM sample) AS "minFame",
      (SELECT count(*)::int FROM styles) AS "sampleSize",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'learned', learned, 'levels', levels) ORDER BY name), '[]'::jsonb)
        FROM (
          SELECT name, sum(count)::int AS learned, jsonb_agg(jsonb_build_array(level, count) ORDER BY level) AS levels
          FROM skill_levels
          GROUP BY name
        ) learned_skills
      ) AS skills,
      (${selectionCountsSql('evolutions')}) AS evolutions,
      (${selectionCountsSql('enhancements')}) AS enhancements`

  return adoption
}

export type JobSkillAdoptionSnapshot = JobSkillAdoptionQuery & {
  computedAt: Date
  adoption: JobSkillAdoption
}

export async function readFamedJobGrows(client: DatabaseClient): Promise<SkillStyleSampleJob[]> {
  return client.$queryRaw<SkillStyleSampleJob[]>`
    SELECT DISTINCT "job_id" AS "jobId", "job_grow_id" AS "jobGrowId"
    FROM "characters"
    WHERE "job_id" IS NOT NULL AND "job_grow_id" IS NOT NULL AND "fame" IS NOT NULL
    ORDER BY 1, 2`
}

export async function saveJobSkillAdoption(
  client: DatabaseClient,
  { jobId, jobGrowId, role, computedAt, adoption }: JobSkillAdoptionSnapshot
): Promise<void> {
  const key = { jobId, jobGrowId, role: role ?? 'all' }
  const values = { computedAt, ...adoption }
  await client.jobSkillAdoptionSnapshot.upsert({
    where: { jobId_jobGrowId_role: key },
    create: { ...key, ...values },
    update: values
  })
}

export async function deleteJobSkillAdoptionComputedBefore(
  client: DatabaseClient,
  before: Date
): Promise<number> {
  const { count } = await client.jobSkillAdoptionSnapshot.deleteMany({
    where: { computedAt: { lt: before } }
  })

  return count
}
