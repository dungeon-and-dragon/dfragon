import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'

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

export type SkillStyleChainBackfillKey = {
  serverId: string
  characterId: string
}

export type SkillStyleHistorySource = {
  observedAt: Date
  jobId: string
  jobGrowId: string
  body: Readonly<Record<string, unknown>>
}

export type SkillStyleChainBackfillRow = SkillStyleChainBackfillKey & {
  jobId: string
  jobGrowId: string
  /** 그 캐릭터의 가장 새 스킬 스타일 이력 원문과 그때의 전직이다. 이력이 없으면 null이다. */
  source: SkillStyleHistorySource | null
}

type SkillStyleChainBackfillQueryRow = SkillStyleChainBackfillKey & {
  jobId: string
  jobGrowId: string
  observedAt: Date | null
  sourceJobId: string | null
  sourceJobGrowId: string | null
  body: Readonly<Record<string, unknown>> | null
}

function toBackfillRow({
  observedAt,
  sourceJobId,
  sourceJobGrowId,
  body,
  ...style
}: SkillStyleChainBackfillQueryRow): SkillStyleChainBackfillRow {
  if (observedAt === null || sourceJobId === null || sourceJobGrowId === null || body === null) {
    return { ...style, source: null }
  }

  return { ...style, source: { observedAt, jobId: sourceJobId, jobGrowId: sourceJobGrowId, body } }
}

// 이력 원문에는 캐릭터 헤더가 빠져 있어, 원문을 받은 시각에 저장된 기본 정보 이력 행에서 그때의 전직을 읽는다.
export async function readSkillStyleChainBackfillPage(
  client: DatabaseClient,
  { after, limit }: { after: SkillStyleChainBackfillKey | null; limit: number }
): Promise<SkillStyleChainBackfillRow[]> {
  const afterCondition =
    after !== null
      ? Prisma.sql`AND (style."server_id", style."character_id") > (${after.serverId}, ${after.characterId})`
      : Prisma.empty

  const rows = await client.$queryRaw<SkillStyleChainBackfillQueryRow[]>`
    SELECT style."server_id" AS "serverId", style."character_id" AS "characterId",
      style."job_id" AS "jobId", style."job_grow_id" AS "jobGrowId",
      source."observed_at" AS "observedAt", source."data" AS "body",
      basic."job_id" AS "sourceJobId", basic."job_grow_id" AS "sourceJobGrowId"
    FROM "character_skill_styles" style
    LEFT JOIN LATERAL (
      SELECT history."observed_at", history."data"
      FROM "character_section_history" history
      WHERE history."server_id" = style."server_id"
        AND history."character_id" = style."character_id"
        AND history."section" = 'skill_style'
      ORDER BY history."observed_at" DESC
      LIMIT 1
    ) source ON true
    LEFT JOIN LATERAL (
      SELECT history."job_id", history."job_grow_id"
      FROM "character_basic_history" history
      WHERE history."server_id" = style."server_id"
        AND history."character_id" = style."character_id"
        AND history."observed_at" <= source."observed_at"
      ORDER BY history."observed_at" DESC
      LIMIT 1
    ) basic ON true
    WHERE style."chain" IS NULL ${afterCondition}
    ORDER BY style."server_id", style."character_id"
    LIMIT ${limit}`

  return rows.map(toBackfillRow)
}

// 읽은 뒤 상세 조회가 체인을 저장했거나 전직이 바뀐 행은 원문보다 새 값이므로 덮지 않는다.
export async function fillCharacterSkillStyleChain(
  client: DatabaseClient,
  style: CharacterSkillStyleInput
): Promise<boolean> {
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

  const updated = await client.$executeRaw`
    UPDATE "character_skill_styles" SET
      "skills" = ${JSON.stringify(skills)}::jsonb,
      "evolutions" = ${JSON.stringify(evolutions)}::jsonb,
      "enhancements" = ${JSON.stringify(enhancements)}::jsonb,
      "chain" = ${chainJson(chain)}::jsonb,
      "fetched_at" = ${fetchedAt}
    WHERE "server_id" = ${serverId} AND "character_id" = ${characterId}
      AND "job_id" = ${jobId} AND "job_grow_id" = ${jobGrowId}
      AND "chain" IS NULL`

  return updated > 0
}
