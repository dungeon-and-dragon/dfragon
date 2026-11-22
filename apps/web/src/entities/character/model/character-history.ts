import { z } from 'zod'
import type { CharacterDetailView } from './character-detail-view'

const observedAt = z.iso.datetime()
const changeValue = z.union([z.number(), z.string()]).nullable()
const nullableText = z.string().nullable()

const fieldChangeSchema = z.object({
  field: z.enum(['reinforce', 'amplify', 'refine', 'tune', 'enchant', 'rarity', 'point']),
  name: nullableText,
  before: changeValue,
  after: changeValue
})

const replacedSchema = z.object({ itemName: z.string(), itemRarity: nullableText }).nullable()

const changeItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('equipment'),
    slotId: z.string(),
    slotName: z.string(),
    itemName: nullableText,
    itemRarity: nullableText,
    replaced: replacedSchema,
    fields: z.array(fieldChangeSchema)
  }),
  z.object({
    kind: z.literal('artifact'),
    slotColor: z.string(),
    itemName: nullableText,
    itemRarity: nullableText,
    replaced: replacedSchema
  }),
  z.object({
    kind: z.literal('set'),
    setItemId: z.string(),
    setItemName: z.string(),
    fields: z.array(fieldChangeSchema)
  })
])

export const characterHistorySchema = z.object({
  basics: z.array(z.object({ observedAt, fame: z.number().nullable() })),
  scores: z.array(
    z.object({
      observedAt,
      calculator: z.enum(['equipment', 'buff']),
      value: z.number(),
      approximate: z
        .object({ source: z.string().trim().min(1) })
        .nullable()
        .default(null)
    })
  ),
  sectionChanges: z.record(z.string(), z.array(observedAt)),
  nameChanges: z.array(
    z.object({
      kind: z.enum(['character', 'adventure']),
      at: observedAt,
      before: z.string(),
      after: z.string()
    })
  ),
  changes: z.array(z.object({ observedAt, first: z.boolean(), items: z.array(changeItemSchema) }))
})

export type CharacterHistory = z.infer<typeof characterHistorySchema>

export type HistoryChangeItem = z.infer<typeof changeItemSchema>

export type HistoryFieldChange = z.infer<typeof fieldChangeSchema>

export type HistoryNameChange = CharacterHistory['nameChanges'][number]

export type ScoreCalculator = CharacterHistory['scores'][number]['calculator']

export type HistoryPoint = Readonly<{
  observedAt: string
  first: boolean
  parts: readonly string[]
  items: readonly HistoryChangeItem[]
  unchanged: readonly string[]
  fame: number | null
  score: number | null
  approximate: boolean
}>

export type HistorySnapshotSummary = Readonly<{
  setPoint: number | null
  mistLevel: number | null
}>

export const SET_PART = '세트'
export const ARTIFACT_PART = '크리쳐'

// 확정 시안(#1627)은 스탯 변화를 보이지 않으므로 스탯 섹션은 "그대로"에도 넣지 않는다.
const UNCHANGED_GROUPS = [
  { label: '장비', sections: ['equipment'] },
  { label: '아바타', sections: ['avatar'] },
  { label: '크리쳐', sections: ['creature'] },
  { label: '서약', sections: ['oath'] },
  { label: '스킬', sections: ['skill_style'] },
  { label: '버프 강화', sections: ['buff_equipment', 'buff_avatar', 'buff_creature'] },
  { label: '안개 융화', sections: ['mist_assimilation'] }
] as const

function partOf(item: HistoryChangeItem): string {
  switch (item.kind) {
    case 'equipment':
      return item.slotName
    case 'set':
      return SET_PART
    case 'artifact':
      return ARTIFACT_PART
  }
}

function latestAt<Row extends Readonly<{ observedAt: string }>>(
  rows: readonly Row[],
  time: number
): Row | undefined {
  return rows.findLast((row) => Date.parse(row.observedAt) <= time)
}

function unchangedAt(sectionChanges: CharacterHistory['sectionChanges'], time: number): string[] {
  return UNCHANGED_GROUPS.flatMap(({ label, sections }) => {
    const changed = sections.some((section) =>
      (sectionChanges[section] ?? []).some((at) => Date.parse(at) === time)
    )

    if (changed) {
      return []
    }

    return [label]
  })
}

export function toHistoryPoints(
  history: CharacterHistory,
  calculator: ScoreCalculator
): HistoryPoint[] {
  const scores = history.scores.filter((score) => score.calculator === calculator)

  return history.changes
    .map(({ observedAt, first, items }) => {
      const time = Date.parse(observedAt)
      const parts = [...new Set(items.map(partOf))]
      const unchanged = first ? [] : unchangedAt(history.sectionChanges, time)
      const fame = latestAt(history.basics, time)?.fame ?? null
      const latestScore = latestAt(scores, time)
      const score = latestScore?.value ?? null
      const approximate = latestScore?.approximate != null

      return { observedAt, first, parts, items, unchanged, fame, score, approximate }
    })
    .toReversed()
}

export function toHistorySnapshotSummary(
  detail: Pick<CharacterDetailView, 'equipment' | 'mistAssimilation'>
): HistorySnapshotSummary {
  const setPoint =
    detail.equipment.setItemInfo
      .map((set) => set.active?.setPoint?.current ?? null)
      .find((point) => point !== null) ?? null
  const mistLevel = detail.mistAssimilation?.level ?? null

  return { setPoint, mistLevel }
}
