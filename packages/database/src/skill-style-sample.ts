import type { CollectedCharacter } from './character-collection.js'
import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'

export const SKILL_STYLE_SAMPLE_TOP_PERCENT = 10

export type SkillStyleSampleJob = {
  jobId: string
  jobGrowId: string
}

export function skillStyleSampleSql({ jobId, jobGrowId }: SkillStyleSampleJob): Prisma.Sql {
  return Prisma.sql`
    SELECT "server_id", "character_id", "fame"
    FROM (
      SELECT "server_id", "character_id", "fame",
        percent_rank() OVER (ORDER BY "fame" DESC) AS "fame_rank"
      FROM "characters"
      WHERE "job_id" = ${jobId} AND "job_grow_id" = ${jobGrowId} AND "fame" IS NOT NULL
    ) AS "ranked"
    WHERE "fame_rank" <= ${SKILL_STYLE_SAMPLE_TOP_PERCENT}::float8 / 100`
}

export async function readSkillStyleSampleJobs(
  client: DatabaseClient
): Promise<SkillStyleSampleJob[]> {
  return client.$queryRaw<SkillStyleSampleJob[]>`
    SELECT DISTINCT "job_id" AS "jobId", "job_grow_id" AS "jobGrowId"
    FROM "characters"
    WHERE "job_id" IS NOT NULL AND "job_grow_id" IS NOT NULL AND "fame" IS NOT NULL
    ORDER BY "jobId", "jobGrowId"`
}

export async function takeSkillStyleRefreshBatch(
  client: DatabaseClient,
  job: SkillStyleSampleJob,
  fetchedBefore: Date,
  skipped: readonly CollectedCharacter[],
  limit: number
): Promise<CollectedCharacter[]> {
  const skippedServerIds = skipped.map((character) => character.serverId)
  const skippedCharacterIds = skipped.map((character) => character.characterId)

  return client.$queryRaw<CollectedCharacter[]>`
    SELECT "sample"."server_id" AS "serverId", "sample"."character_id" AS "characterId"
    FROM (${skillStyleSampleSql(job)}) AS "sample"
    LEFT JOIN "character_skill_styles" AS "style"
      ON "style"."server_id" = "sample"."server_id"
      AND "style"."character_id" = "sample"."character_id"
    WHERE ("style"."fetched_at" IS NULL OR "style"."fetched_at" < ${fetchedBefore})
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(${skippedServerIds}::text[], ${skippedCharacterIds}::text[])
          AS "skipped"("server_id", "character_id")
        WHERE "skipped"."server_id" = "sample"."server_id"
          AND "skipped"."character_id" = "sample"."character_id"
      )
    ORDER BY "style"."fetched_at" ASC NULLS FIRST, "sample"."server_id", "sample"."character_id"
    LIMIT ${limit}`
}
