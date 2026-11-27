import type { DatabaseClient } from './client.js'
import type { LabCurrencyIcon } from './lab-currency.js'

// 공개 API의 카드 상세와 같은 모양으로, 단계마다 옵션 이름과 값을 둔다.
export type LabItemCard = {
  slots: string[]
  enchants: { upgrade: number; status: { name: string; value: string }[] }[]
}

// tooltip에 보일 값이고, null이면 tooltip에서 그 줄을 빼고 보인다.
export type LabItemTooltipFields = {
  itemTypeDetail: string | null
  availableLevel: number | null
  fame: number | null
  card: LabItemCard | null
}

export type LabItemDetailSummary = LabItemTooltipFields & {
  itemName: string
  description: string | null
  itemRarity: string | null
  hasIcon: boolean
  updatedAt: Date
}

export type LabItemDetailInput = LabItemTooltipFields & {
  description: string | null
  itemRarity: string | null
}

// icon이 undefined면 저장한 아이콘을 그대로 두고, null이면 지운다.
export type LabItemDetailIconChange = LabCurrencyIcon | null | undefined

export async function readLabItemDetails(client: DatabaseClient): Promise<LabItemDetailSummary[]> {
  return client.$queryRaw<LabItemDetailSummary[]>`
    SELECT
      "item_name" AS "itemName", "description", "item_rarity" AS "itemRarity",
      "item_type_detail" AS "itemTypeDetail", "available_level" AS "availableLevel", "fame",
      "card", "icon" IS NOT NULL AS "hasIcon", "updated_at" AS "updatedAt"
    FROM "lab_item_details"
    ORDER BY "item_name"`
}

export async function readLabItemDetailIcon(
  client: DatabaseClient,
  itemName: string
): Promise<LabCurrencyIcon | null> {
  const row = await client.labItemDetail.findUnique({
    where: { itemName },
    select: { icon: true, iconContentType: true }
  })

  if (row === null || row.icon === null || row.iconContentType === null) {
    return null
  }

  return { bytes: row.icon, contentType: row.iconContentType }
}

export async function saveLabItemDetail(
  client: DatabaseClient,
  itemName: string,
  { description, itemRarity, itemTypeDetail, availableLevel, fame, card }: LabItemDetailInput,
  icon: LabItemDetailIconChange
): Promise<void> {
  const keepIcon = icon === undefined
  const bytes = icon?.bytes ?? null
  const contentType = icon?.contentType ?? null
  const cardJson = card !== null ? JSON.stringify(card) : null

  await client.$executeRaw`
    INSERT INTO "lab_item_details" (
      "item_name", "icon", "icon_content_type", "description", "item_rarity",
      "item_type_detail", "available_level", "fame", "card"
    )
    VALUES (
      ${itemName}, ${bytes}::bytea, ${contentType}, ${description}, ${itemRarity},
      ${itemTypeDetail}, ${availableLevel}::integer, ${fame}::integer, ${cardJson}::jsonb
    )
    ON CONFLICT ("item_name") DO UPDATE SET
      "icon" = CASE WHEN ${keepIcon} THEN "lab_item_details"."icon" ELSE EXCLUDED."icon" END,
      "icon_content_type" = CASE
        WHEN ${keepIcon} THEN "lab_item_details"."icon_content_type"
        ELSE EXCLUDED."icon_content_type"
      END,
      "description" = EXCLUDED."description",
      "item_rarity" = EXCLUDED."item_rarity",
      "item_type_detail" = EXCLUDED."item_type_detail",
      "available_level" = EXCLUDED."available_level",
      "fame" = EXCLUDED."fame",
      "card" = EXCLUDED."card",
      "updated_at" = CURRENT_TIMESTAMP`
}
