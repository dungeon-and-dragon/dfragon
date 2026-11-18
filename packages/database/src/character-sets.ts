import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'

export type CharacterEquipmentSet = {
  id: string
  name: string
}

export type CharacterOathSet = {
  id: number
  name: string
  option: string | null
}

export type CharacterItem = {
  slotId: string
  itemId: string
  itemName: string
}

export type CharacterSets = {
  equipmentSet: CharacterEquipmentSet | null
  oathSet: CharacterOathSet | null
  items: readonly CharacterItem[]
}

export type CharacterSetsInput = CharacterSets & {
  serverId: string
  characterId: string
  fetchedAt: Date
}

type CharacterKey = Pick<CharacterSetsInput, 'serverId' | 'characterId'>

export async function recordCharacterSets(
  client: DatabaseClient,
  input: CharacterSetsInput
): Promise<void> {
  const { serverId, characterId, fetchedAt } = input

  await client.$transaction(async (transaction) => {
    // 같은 캐릭터의 저장이 겹쳐도 시각 비교와 세트, 아이템 교체가 한 번에 하나씩 일어나도록 캐릭터 행을 먼저 잠근다.
    const [stored] = await transaction.$queryRaw<{ setsFetchedAt: Date | null }[]>`
      SELECT "sets_fetched_at" AS "setsFetchedAt"
      FROM "characters"
      WHERE "server_id" = ${serverId} AND "character_id" = ${characterId}
      FOR UPDATE`

    // 상세 조회는 캐시한 응답으로도 저장하므로, 그 뒤에 더 새로 받아 저장한 값을 예전 응답으로 덮지 않는다.
    if (
      stored === undefined ||
      (stored.setsFetchedAt !== null && stored.setsFetchedAt > fetchedAt)
    ) {
      return
    }

    // 아이템만 바뀐 저장도 받은 시각을 옮겨야, 그보다 이른 캐시 응답이 아이템을 예전 값으로 되돌리지 않는다.
    const itemsChanged = await replaceItems(transaction, input, input.items)
    await writeSets(transaction, input, itemsChanged)
  })
}

// 주 1회 job이 92만 행을 다시 저장하므로 세트와 아이템이 모두 같으면 받은 시각도 옮기지 않아 행을 쓰지 않는다.
async function writeSets(
  transaction: Prisma.TransactionClient,
  { serverId, characterId, equipmentSet, oathSet, fetchedAt }: CharacterSetsInput,
  itemsChanged: boolean
): Promise<void> {
  const equipmentSetId = equipmentSet?.id ?? null
  const equipmentSetName = equipmentSet?.name ?? null
  const oathSetId = oathSet?.id ?? null
  const oathSetName = oathSet?.name ?? null
  const oathSetOption = oathSet?.option ?? null

  await transaction.$executeRaw`
    UPDATE "characters" SET
      "equipment_set_id" = ${equipmentSetId},
      "equipment_set_name" = ${equipmentSetName},
      "oath_set_id" = ${oathSetId}::int,
      "oath_set_name" = ${oathSetName},
      "oath_set_option" = ${oathSetOption},
      "sets_fetched_at" = ${fetchedAt}
    WHERE "server_id" = ${serverId}
      AND "character_id" = ${characterId}
      AND (
        "sets_fetched_at" IS NULL
        OR ${itemsChanged}
        OR ("equipment_set_id", "equipment_set_name", "oath_set_id", "oath_set_name", "oath_set_option")
          IS DISTINCT FROM (${equipmentSetId}, ${equipmentSetName}, ${oathSetId}::int, ${oathSetName}, ${oathSetOption})
      )`
}

async function replaceItems(
  transaction: Prisma.TransactionClient,
  { serverId, characterId }: CharacterKey,
  items: readonly CharacterItem[]
): Promise<boolean> {
  const slotIds = items.map(({ slotId }) => slotId)
  const { count: deleted } = await transaction.characterItem.deleteMany({
    where: { serverId, characterId, slotId: { notIn: slotIds } }
  })
  let written = 0

  for (const { slotId, itemId, itemName } of items) {
    written += await transaction.$executeRaw`
      INSERT INTO "character_items" ("server_id", "character_id", "slot_id", "item_id", "item_name")
      VALUES (${serverId}, ${characterId}, ${slotId}, ${itemId}, ${itemName})
      ON CONFLICT ("server_id", "character_id", "slot_id") DO UPDATE SET
        "item_id" = EXCLUDED."item_id",
        "item_name" = EXCLUDED."item_name"
      WHERE ("character_items"."item_id", "character_items"."item_name")
        IS DISTINCT FROM (EXCLUDED."item_id", EXCLUDED."item_name")`
  }

  return deleted + written > 0
}
