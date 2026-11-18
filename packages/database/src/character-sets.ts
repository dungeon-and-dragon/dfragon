import type { DatabaseClient } from './client.js'

export type CharacterEquipmentSet = {
  id: string
  name: string
}

export type CharacterOathSet = {
  id: number
  name: string
  option: string | null
}

export type CharacterSets = {
  equipmentSet: CharacterEquipmentSet | null
  oathSet: CharacterOathSet | null
}

export type CharacterSetsInput = CharacterSets & {
  serverId: string
  characterId: string
  fetchedAt: Date
}

export async function recordCharacterSets(
  client: DatabaseClient,
  input: CharacterSetsInput
): Promise<void> {
  const { serverId, characterId, equipmentSet, oathSet, fetchedAt } = input
  const equipmentSetId = equipmentSet?.id ?? null
  const equipmentSetName = equipmentSet?.name ?? null
  const oathSetId = oathSet?.id ?? null
  const oathSetName = oathSet?.name ?? null
  const oathSetOption = oathSet?.option ?? null

  // 상세 조회는 캐시한 응답으로도 저장하므로, 그 뒤에 더 새로 받아 저장한 값을 예전 응답으로 덮지 않는다.
  // 주 1회 job이 92만 행을 다시 저장하므로 값이 같으면 받은 시각도 옮기지 않아 행을 쓰지 않는다.
  await client.$executeRaw`
    UPDATE "characters" SET
      "equipment_set_id" = ${equipmentSetId},
      "equipment_set_name" = ${equipmentSetName},
      "oath_set_id" = ${oathSetId}::int,
      "oath_set_name" = ${oathSetName},
      "oath_set_option" = ${oathSetOption},
      "sets_fetched_at" = ${fetchedAt}
    WHERE "server_id" = ${serverId}
      AND "character_id" = ${characterId}
      AND ("sets_fetched_at" IS NULL OR "sets_fetched_at" <= ${fetchedAt})
      AND (
        "sets_fetched_at" IS NULL
        OR ("equipment_set_id", "equipment_set_name", "oath_set_id", "oath_set_name", "oath_set_option")
          IS DISTINCT FROM (${equipmentSetId}, ${equipmentSetName}, ${oathSetId}::int, ${oathSetName}, ${oathSetOption})
      )`
}
