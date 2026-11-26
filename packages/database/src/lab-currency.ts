import type { DatabaseClient } from './client.js'

export type LabCurrencyIcon = {
  bytes: Uint8Array<ArrayBuffer>
  contentType: string
}

export type LabCurrencySummary = {
  id: number
  name: string
  updatedAt: Date
}

export type LabCurrencyAddition = { status: 'added'; id: number } | { status: 'duplicate' }

export type LabCurrencyUpdate = { status: 'updated' | 'duplicate' | 'notFound' }

type StoredLabCurrencySummary = Omit<LabCurrencySummary, 'id'> & { id: bigint }

function toSummary({ id, ...currency }: StoredLabCurrencySummary): LabCurrencySummary {
  const summaryId = Number(id)

  return { id: summaryId, ...currency }
}

// 목록에는 아이콘 본문을 싣지 않고, 아이콘은 id로 따로 읽는다.
export async function readLabCurrencies(client: DatabaseClient): Promise<LabCurrencySummary[]> {
  const rows = await client.labCurrency.findMany({
    select: { id: true, name: true, updatedAt: true },
    orderBy: { id: 'asc' }
  })

  return rows.map(toSummary)
}

export async function readLabCurrencyIcon(
  client: DatabaseClient,
  id: number
): Promise<LabCurrencyIcon | null> {
  const row = await client.labCurrency.findUnique({
    where: { id: BigInt(id) },
    select: { icon: true, iconContentType: true }
  })

  if (row === null) {
    return null
  }

  return { bytes: row.icon, contentType: row.iconContentType }
}

export async function addLabCurrency(
  client: DatabaseClient,
  name: string,
  icon: LabCurrencyIcon
): Promise<LabCurrencyAddition> {
  const rows = await client.$queryRaw<{ id: bigint }[]>`
    INSERT INTO "lab_currencies" ("name", "icon", "icon_content_type")
    VALUES (${name}, ${icon.bytes}, ${icon.contentType})
    ON CONFLICT ("name") DO NOTHING
    RETURNING "id"`
  const added = rows[0]

  if (added === undefined) {
    return { status: 'duplicate' }
  }

  const id = Number(added.id)

  return { status: 'added', id }
}

// 아이콘을 주지 않으면 이름만 바꾸고, 다른 재화가 쓰는 이름으로는 바꾸지 않는다.
export async function updateLabCurrency(
  client: DatabaseClient,
  id: number,
  name: string,
  icon: LabCurrencyIcon | null
): Promise<LabCurrencyUpdate> {
  const rows = await client.$queryRaw<{ id: bigint }[]>`
    UPDATE "lab_currencies"
    SET
      "name" = ${name},
      "icon" = coalesce(${icon?.bytes ?? null}::bytea, "icon"),
      "icon_content_type" = coalesce(${icon?.contentType ?? null}, "icon_content_type"),
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${BigInt(id)}
      AND NOT EXISTS (
        SELECT 1 FROM "lab_currencies" WHERE "name" = ${name} AND "id" <> ${BigInt(id)}
      )
    RETURNING "id"`

  if (rows.length > 0) {
    return { status: 'updated' }
  }

  const found = await client.labCurrency.count({ where: { id: BigInt(id) } })

  if (found > 0) {
    return { status: 'duplicate' }
  }

  return { status: 'notFound' }
}
