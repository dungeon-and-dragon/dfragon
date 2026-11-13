import type { DatabaseClient } from './client.js'

export type BatchNeopleKeySummary = {
  id: number
  label: string
  keySuffix: string
  enabled: boolean
  createdAt: Date
  rejectedAt: Date | null
}

export type BatchNeopleKeyInput = {
  label: string
  key: string
}

export type UsableBatchNeopleKey = {
  id: number
  key: string
}

export type BatchNeopleKeyAddition = { status: 'added'; id: number } | { status: 'duplicate' }

// 원문은 운영 응답에 내지 않으므로 끝 4자만 DB에서 잘라 읽는다.
export async function readBatchNeopleKeys(
  client: DatabaseClient
): Promise<BatchNeopleKeySummary[]> {
  return client.$queryRaw<BatchNeopleKeySummary[]>`
    SELECT
      "id", "label", right("key", 4) AS "keySuffix", "enabled",
      "created_at" AS "createdAt", "rejected_at" AS "rejectedAt"
    FROM "batch_neople_keys"
    ORDER BY "id"`
}

// 중복을 unique 위반 오류로 받으면 Prisma 오류 meta에 값이 실릴 수 있어 ON CONFLICT로 거른다.
export async function addBatchNeopleKey(
  client: DatabaseClient,
  { label, key }: BatchNeopleKeyInput
): Promise<BatchNeopleKeyAddition> {
  const rows = await client.$queryRaw<{ id: number }[]>`
    INSERT INTO "batch_neople_keys" ("label", "key")
    VALUES (${label}, ${key})
    ON CONFLICT ("key") DO NOTHING
    RETURNING "id"`
  const added = rows[0]

  if (added === undefined) {
    return { status: 'duplicate' }
  }

  return { status: 'added', id: added.id }
}

// 다시 켜면 거절 기록도 지워 worker가 그 key를 다시 쓰게 한다.
export async function setBatchNeopleKeyEnabled(
  client: DatabaseClient,
  id: number,
  enabled: boolean
): Promise<boolean> {
  const data = enabled ? { enabled, rejectedAt: null } : { enabled }
  const { count } = await client.batchNeopleKey.updateMany({ where: { id }, data })

  return count > 0
}

export async function deleteBatchNeopleKey(client: DatabaseClient, id: number): Promise<boolean> {
  const { count } = await client.batchNeopleKey.deleteMany({ where: { id } })

  return count > 0
}

export async function readUsableBatchNeopleKeys(
  client: DatabaseClient
): Promise<UsableBatchNeopleKey[]> {
  return client.batchNeopleKey.findMany({
    where: { enabled: true, rejectedAt: null },
    orderBy: { id: 'asc' },
    select: { id: true, key: true }
  })
}

export async function recordBatchNeopleKeyRejected(
  client: DatabaseClient,
  id: number
): Promise<void> {
  const rejectedAt = new Date()
  await client.batchNeopleKey.updateMany({
    where: { id, rejectedAt: null },
    data: { rejectedAt }
  })
}
