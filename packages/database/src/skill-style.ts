import type { DatabaseClient } from './client.js'

export type SkillStyleSkill = {
  name: string
  level: number
}

export type SkillStyleSelection = {
  name: string
  type: number
}

export type CharacterSkillStyleInput = {
  serverId: string
  characterId: string
  jobId: string
  jobGrowId: string
  skills: readonly SkillStyleSkill[]
  evolutions: readonly SkillStyleSelection[]
  enhancements: readonly SkillStyleSelection[]
  fetchedAt: Date
}

export async function recordCharacterSkillStyle(
  client: DatabaseClient,
  style: CharacterSkillStyleInput
): Promise<void> {
  const { serverId, characterId, jobId, jobGrowId, skills, evolutions, enhancements, fetchedAt } =
    style

  // 상세 조회는 캐시한 응답으로도 저장하므로, 그 뒤에 더 새로 받아 저장한 행을 예전 응답으로 덮지 않는다.
  await client.$executeRaw`
    INSERT INTO "character_skill_styles"
      ("server_id", "character_id", "job_id", "job_grow_id", "skills", "evolutions", "enhancements", "fetched_at")
    VALUES (
      ${serverId}, ${characterId}, ${jobId}, ${jobGrowId},
      ${JSON.stringify(skills)}::jsonb, ${JSON.stringify(evolutions)}::jsonb, ${JSON.stringify(enhancements)}::jsonb,
      ${fetchedAt}
    )
    ON CONFLICT ("server_id", "character_id") DO UPDATE SET
      "job_id" = EXCLUDED."job_id",
      "job_grow_id" = EXCLUDED."job_grow_id",
      "skills" = EXCLUDED."skills",
      "evolutions" = EXCLUDED."evolutions",
      "enhancements" = EXCLUDED."enhancements",
      "fetched_at" = EXCLUDED."fetched_at"
    WHERE "character_skill_styles"."fetched_at" <= EXCLUDED."fetched_at"`
}
