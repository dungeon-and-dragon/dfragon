import { SKILL_STYLE_SAMPLE_TOP_COUNT } from '@dfragon/lib'
import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'

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

export type SkillStyleSampleCharacter = {
  serverId: string
  characterId: string
}

// 전직을 바꾼 뒤 다시 받지 않은 스킬 스타일은 채택률이 세지 않으므로 없는 것과 같이 다시 받는다.
export async function readSampleCharactersWithoutSkillStyle(
  client: DatabaseClient
): Promise<SkillStyleSampleCharacter[]> {
  return client.$queryRaw<SkillStyleSampleCharacter[]>`
    SELECT "ranked"."server_id" AS "serverId", "ranked"."character_id" AS "characterId"
    FROM (
      SELECT "server_id", "character_id", "job_id", "job_grow_id", "fame",
        rank() OVER (PARTITION BY "job_id", "job_grow_id" ORDER BY "fame" DESC) AS "fame_rank"
      FROM "characters"
      WHERE "job_id" IS NOT NULL AND "job_grow_id" IS NOT NULL AND "fame" IS NOT NULL
    ) AS "ranked"
    WHERE "ranked"."fame_rank" <= ${SKILL_STYLE_SAMPLE_TOP_COUNT}
      AND NOT EXISTS (
        SELECT 1
        FROM "character_skill_styles" AS "style"
        WHERE "style"."server_id" = "ranked"."server_id"
          AND "style"."character_id" = "ranked"."character_id"
          AND "style"."job_id" = "ranked"."job_id"
          AND "style"."job_grow_id" = "ranked"."job_grow_id"
      )
    ORDER BY "ranked"."job_id", "ranked"."job_grow_id", "ranked"."fame" DESC,
      "ranked"."server_id", "ranked"."character_id"`
}
