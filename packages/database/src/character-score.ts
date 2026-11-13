import type { DatabaseClient } from './client.js'

export type CharacterScoreKind = 'equipment' | 'buff'

export type CharacterScoreInput = {
  serverId: string
  characterId: string
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
  const { serverId, characterId, kind, score, calculatedAt, engine } = input

  // 비교와 갱신을 한 문장으로 해, 같은 캐릭터를 동시에 저장해도 낮은 점수가 높은 점수를 덮지 않는다.
  // 엔진 버전이나 점수 종류가 다르면 값끼리 비교할 수 없으므로 새 값으로 덮는다.
  await client.$executeRaw`
    INSERT INTO "character_scores"
      ("server_id", "character_id", "kind", "score", "calculated_at",
       "engine_package", "engine_rules_rev", "engine_bundle_id")
    VALUES (
      ${serverId}, ${characterId}, ${kind}, ${score}::integer, ${calculatedAt},
      ${engine.package}, ${engine.rulesRev}, ${engine.bundleId}
    )
    ON CONFLICT ("server_id", "character_id") DO UPDATE SET
      "kind" = EXCLUDED."kind",
      "score" = EXCLUDED."score",
      "calculated_at" = EXCLUDED."calculated_at",
      "engine_package" = EXCLUDED."engine_package",
      "engine_rules_rev" = EXCLUDED."engine_rules_rev",
      "engine_bundle_id" = EXCLUDED."engine_bundle_id"
    WHERE ("character_scores"."kind", "character_scores"."engine_package",
           "character_scores"."engine_rules_rev", "character_scores"."engine_bundle_id")
          IS DISTINCT FROM
          (EXCLUDED."kind", EXCLUDED."engine_package", EXCLUDED."engine_rules_rev", EXCLUDED."engine_bundle_id")
       OR "character_scores"."score" <= EXCLUDED."score"`
}
