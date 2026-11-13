import type { DatabaseClient } from './client.js'

type ClearRecordBase = {
  serverId: string
  characterId: string
  name: string
  clearedAt: Date
  weekStart: Date
}

export type RaidClearRecordInput = ClearRecordBase & {
  kind: 'raid'
  modeName: string | null
  hard: boolean
  partyName: string | null
}

export type LegionClearRecordInput = ClearRecordBase & {
  kind: 'legion'
}

export type ClearRecordInput = RaidClearRecordInput | LegionClearRecordInput

function toRaidFields(record: ClearRecordInput) {
  if (record.kind === 'legion') {
    return { modeName: null, hard: null, partyName: null }
  }

  const { modeName, hard, partyName } = record

  return { modeName, hard, partyName }
}

// 한 캐릭터는 같은 분에 같은 컨텐츠를 두 번 깰 수 없어 단계 없이 시각까지로 같은 기록을 가린다.
// 같은 기록은 이미 있는 행이든 같은 묶음 안의 앞 행이든 ON CONFLICT DO NOTHING이 건너뛴다.
export async function recordClearRecords(
  client: DatabaseClient,
  records: readonly ClearRecordInput[]
): Promise<void> {
  if (records.length === 0) {
    return
  }

  const raidFields = records.map(toRaidFields)

  await client.$executeRaw`
    INSERT INTO "clear_records"
      ("server_id", "character_id", "kind", "name", "mode_name", "hard", "party_name",
       "cleared_at", "week_start")
    SELECT * FROM unnest(
      ${records.map(({ serverId }) => serverId)}::text[],
      ${records.map(({ characterId }) => characterId)}::text[],
      ${records.map(({ kind }) => kind)}::text[],
      ${records.map(({ name }) => name)}::text[],
      ${raidFields.map(({ modeName }) => modeName)}::text[],
      ${raidFields.map(({ hard }) => hard)}::boolean[],
      ${raidFields.map(({ partyName }) => partyName)}::text[],
      ${records.map(({ clearedAt }) => clearedAt)}::timestamptz[],
      ${records.map(({ weekStart }) => weekStart)}::timestamptz[]
    )
    ON CONFLICT ("server_id", "character_id", "cleared_at", "kind", "name") DO NOTHING`
}

export type ClearRecordBackfillProgress = {
  startedAt: Date
  done: number
}

// 지난 기록 받기가 끝나기 전까지만 행이 있어, 다시 시작한 실행이 같은 시작 시각과 처리한 캐릭터 수로 이어 받는다.
export async function readClearRecordBackfill(
  client: DatabaseClient
): Promise<ClearRecordBackfillProgress | undefined> {
  const progress = await client.clearRecordBackfill.findFirst({
    orderBy: { startedAt: 'asc' },
    select: { startedAt: true, done: true }
  })

  if (progress === null) {
    return undefined
  }

  return progress
}

export async function startClearRecordBackfill(
  client: DatabaseClient,
  startedAt: Date
): Promise<void> {
  await client.clearRecordBackfill.create({ data: { startedAt } })
}

export async function recordClearRecordBackfillProgress(
  client: DatabaseClient,
  progress: ClearRecordBackfillProgress
): Promise<void> {
  const { startedAt, done } = progress
  await client.clearRecordBackfill.update({ where: { startedAt }, data: { done } })
}

export async function finishClearRecordBackfill(
  client: DatabaseClient,
  startedAt: Date
): Promise<void> {
  await client.clearRecordBackfill.deleteMany({ where: { startedAt } })
}
