import { Prisma } from './generated/prisma/client.js'

export const SKILL_STYLE_SAMPLE_TOP_COUNT = 5000

export type SkillStyleSampleJob = {
  jobId: string
  jobGrowId: string
}

export function skillStyleSampleSql({ jobId, jobGrowId }: SkillStyleSampleJob): Prisma.Sql {
  return Prisma.sql`
    SELECT "server_id", "character_id", "fame"
    FROM (
      SELECT "server_id", "character_id", "fame",
        rank() OVER (ORDER BY "fame" DESC) AS "fame_rank"
      FROM "characters"
      WHERE "job_id" = ${jobId} AND "job_grow_id" = ${jobGrowId} AND "fame" IS NOT NULL
    ) AS "ranked"
    WHERE "fame_rank" <= ${SKILL_STYLE_SAMPLE_TOP_COUNT}`
}
