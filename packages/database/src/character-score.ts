import type { DatabaseClient } from './client.js'

export type CharacterScoreKind = 'equipment' | 'buff'

export type StoredCharacterScore = {
  kind: CharacterScoreKind
  value: number
}

export type StoredCharacterScoreRow = StoredCharacterScore & {
  serverId: string
  characterId: string
}

export type CharacterScoreJob = {
  jobId: string
  jobGrowId: string
}

export type CharacterScoreInput = {
  serverId: string
  characterId: string
  job: CharacterScoreJob | null
  kind: CharacterScoreKind
  score: number
  calculatedAt: Date
  engine: {
    package: string
    rulesRev: string
    bundleId: string
  }
}

export async function recordCharacterScore(
  client: DatabaseClient,
  input: CharacterScoreInput
): Promise<void> {
  const { serverId, characterId, job, kind, score, calculatedAt, engine } = input
  const jobId = job?.jobId ?? null
  const jobGrowId = job?.jobGrowId ?? null

  // 비교와 갱신을 한 문장으로 해, 같은 캐릭터를 동시에 저장해도 낮은 점수가 높은 점수를 덮지 않는다.
  // 엔진 버전, 점수 종류나 계산한 전직이 다르면 값끼리 비교할 수 없으므로 새 값으로 덮는다.
  await client.$executeRaw`
    INSERT INTO "character_scores"
      ("server_id", "character_id", "kind", "score", "calculated_at",
       "engine_package", "engine_rules_rev", "engine_bundle_id", "job_id", "job_grow_id")
    VALUES (
      ${serverId}, ${characterId}, ${kind}, ${score}::integer, ${calculatedAt},
      ${engine.package}, ${engine.rulesRev}, ${engine.bundleId}, ${jobId}, ${jobGrowId}
    )
    ON CONFLICT ("server_id", "character_id") DO UPDATE SET
      "kind" = EXCLUDED."kind",
      "score" = EXCLUDED."score",
      "calculated_at" = EXCLUDED."calculated_at",
      "engine_package" = EXCLUDED."engine_package",
      "engine_rules_rev" = EXCLUDED."engine_rules_rev",
      "engine_bundle_id" = EXCLUDED."engine_bundle_id",
      "job_id" = EXCLUDED."job_id",
      "job_grow_id" = EXCLUDED."job_grow_id"
    WHERE ("character_scores"."kind", "character_scores"."engine_package",
           "character_scores"."engine_rules_rev", "character_scores"."engine_bundle_id",
           "character_scores"."job_id", "character_scores"."job_grow_id")
          IS DISTINCT FROM
          (EXCLUDED."kind", EXCLUDED."engine_package", EXCLUDED."engine_rules_rev", EXCLUDED."engine_bundle_id",
           EXCLUDED."job_id", EXCLUDED."job_grow_id")
       OR "character_scores"."score" <= EXCLUDED."score"`
}

export function readCharacterScores(
  client: DatabaseClient,
  characters: readonly { serverId: string; characterId: string }[]
): Promise<StoredCharacterScoreRow[]> {
  const serverIds = characters.map((character) => character.serverId)
  const characterIds = characters.map((character) => character.characterId)

  return client.$queryRaw<StoredCharacterScoreRow[]>`
    SELECT score.server_id AS "serverId", score.character_id AS "characterId", score.kind, score.score AS value
    FROM unnest(${serverIds}::text[], ${characterIds}::text[]) AS listed(server_id, character_id)
    JOIN character_scores score
      ON score.server_id = listed.server_id AND score.character_id = listed.character_id`
}
