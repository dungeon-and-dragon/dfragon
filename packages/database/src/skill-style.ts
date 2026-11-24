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
  /** 스킬 체인 칸마다 스킬 이름이나 빈 칸의 null이다. null은 체인을 모른다는 뜻이다. */
  chain: readonly (string | null)[] | null
  fetchedAt: Date
}

function chainJson(chain: CharacterSkillStyleInput['chain']): string | null {
  if (chain === null) {
    return null
  }

  return JSON.stringify(chain)
}

export async function recordCharacterSkillStyle(
  client: DatabaseClient,
  style: CharacterSkillStyleInput
): Promise<void> {
  const {
    serverId,
    characterId,
    jobId,
    jobGrowId,
    skills,
    evolutions,
    enhancements,
    chain,
    fetchedAt
  } = style

  // 상세 조회는 캐시한 응답으로도 저장하므로, 그 뒤에 더 새로 받아 저장한 행을 예전 응답으로 덮지 않는다.
  await client.$executeRaw`
    INSERT INTO "character_skill_styles"
      ("server_id", "character_id", "job_id", "job_grow_id", "skills", "evolutions", "enhancements", "chain", "fetched_at")
    VALUES (
      ${serverId}, ${characterId}, ${jobId}, ${jobGrowId},
      ${JSON.stringify(skills)}::jsonb, ${JSON.stringify(evolutions)}::jsonb, ${JSON.stringify(enhancements)}::jsonb,
      ${chainJson(chain)}::jsonb, ${fetchedAt}
    )
    ON CONFLICT ("server_id", "character_id") DO UPDATE SET
      "job_id" = EXCLUDED."job_id",
      "job_grow_id" = EXCLUDED."job_grow_id",
      "skills" = EXCLUDED."skills",
      "evolutions" = EXCLUDED."evolutions",
      "enhancements" = EXCLUDED."enhancements",
      "chain" = EXCLUDED."chain",
      "fetched_at" = EXCLUDED."fetched_at"
    WHERE "character_skill_styles"."fetched_at" <= EXCLUDED."fetched_at"`
}
