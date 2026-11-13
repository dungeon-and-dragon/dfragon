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

export type ClearRecordLegionWeek = {
  name: string
  weekStart: Date
  cleared: number
}

export type ClearRecordRaidSelection = {
  raidName: string
  weekStart: Date
}

export type ClearRecordRaidMode = {
  modeName: string | null
  hard: boolean | null
}

export type ClearRecordRaidStage = ClearRecordRaidMode & { stage: string }

export type ClearRecordStageCount = {
  stage: string
  characters: number
}

// 레기온은 한 캐릭터가 한 주에 여러 번 깨도 한 명으로 센다.
export function readClearRecordLegionWeeks(
  client: DatabaseClient,
  names: readonly string[]
): Promise<ClearRecordLegionWeek[]> {
  return client.$queryRaw<ClearRecordLegionWeek[]>`
    SELECT name, week_start AS "weekStart", count(DISTINCT (server_id, character_id))::int AS cleared
    FROM clear_records
    WHERE kind = 'legion' AND name = ANY(${names}::text[])
    GROUP BY name, week_start
    ORDER BY name, week_start`
}

export function readClearRecordRaidModes(
  client: DatabaseClient,
  { raidName, weekStart }: ClearRecordRaidSelection
): Promise<ClearRecordRaidMode[]> {
  return client.$queryRaw<ClearRecordRaidMode[]>`
    SELECT DISTINCT mode_name AS "modeName", hard
    FROM clear_records
    WHERE kind = 'raid' AND name = ${raidName} AND week_start = ${weekStart}`
}

// 단계 라벨은 API가 modeName과 hard로 정해 넘기고, 같은 라벨의 여러 modeName을 깬 캐릭터는 한 명으로 센다.
export function readClearRecordRaidStageCounts(
  client: DatabaseClient,
  { raidName, weekStart }: ClearRecordRaidSelection,
  stages: readonly ClearRecordRaidStage[]
): Promise<ClearRecordStageCount[]> {
  return client.$queryRaw<ClearRecordStageCount[]>`
    SELECT stage.stage, count(DISTINCT (record.server_id, record.character_id))::int AS characters
    FROM clear_records record
    JOIN unnest(
      ${stages.map(({ modeName }) => modeName)}::text[],
      ${stages.map(({ hard }) => hard)}::boolean[],
      ${stages.map(({ stage }) => stage)}::text[]
    ) AS stage(mode_name, hard, stage)
      ON stage.mode_name IS NOT DISTINCT FROM record.mode_name
      AND stage.hard IS NOT DISTINCT FROM record.hard
    WHERE record.kind = 'raid' AND record.name = ${raidName} AND record.week_start = ${weekStart}
    GROUP BY stage.stage`
}
