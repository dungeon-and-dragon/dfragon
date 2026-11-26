import type { DatabaseClient } from './client.js'

export type LabItemGroup = {
  category: string
  role: string
  tier: string
  itemNames: string[]
}

export async function readLabItemGroups(client: DatabaseClient): Promise<LabItemGroup[]> {
  return client.$queryRaw<LabItemGroup[]>`
    SELECT "category", "role", "tier", array_agg("item_name" ORDER BY "id") AS "itemNames"
    FROM "lab_items"
    GROUP BY "category", "role", "tier"
    ORDER BY "category", "role", "tier"`
}

// 묶음에 남는 이름은 지우지 않아 처음 고른 시각을 그대로 둔다.
export async function replaceLabItemGroup(
  client: DatabaseClient,
  { category, role, tier, itemNames }: LabItemGroup
): Promise<void> {
  const rows = itemNames.map((itemName) => ({ category, role, tier, itemName }))
  await client.$transaction([
    client.labItem.deleteMany({
      where: { category, role, tier, itemName: { notIn: itemNames } }
    }),
    client.labItem.createMany({ data: rows, skipDuplicates: true })
  ])
}
