import type { StoredCharacterSection } from '@dfragon/database'
import { z } from 'zod'

/** 변경점을 만드는 섹션이다. 스탯 등 다른 섹션의 변화는 변경점에 넣지 않는다. */
export const CHANGE_SECTIONS = ['equipment', 'creature'] as const

type ChangeValue = number | string | null

export type CharacterFieldChange = {
  field: 'reinforce' | 'amplify' | 'refine' | 'tune' | 'enchant' | 'rarity' | 'point'
  name: string | null
  before: ChangeValue
  after: ChangeValue
}

type ChangedItem = { itemName: string; itemRarity: string | null }

export type CharacterChangeItem =
  | ({
      kind: 'equipment'
      slotId: string
      slotName: string
      replaced: ChangedItem | null
      fields: CharacterFieldChange[]
    } & NullableItem)
  | ({ kind: 'artifact'; slotColor: string; replaced: ChangedItem | null } & NullableItem)
  | { kind: 'set'; setItemId: string; setItemName: string; fields: CharacterFieldChange[] }

type NullableItem = { itemName: string | null; itemRarity: string | null }

export type CharacterChangePoint = {
  observedAt: string
  first: boolean
  items: CharacterChangeItem[]
}

const valueSchema = z.union([z.number(), z.string()]).nullable().catch(null)

const equipmentItemSchema = z.looseObject({
  slotId: z.string(),
  slotName: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  itemRarity: z.string().nullable().catch(null),
  reinforce: z.number().nullable().catch(null),
  amplificationName: z.string().nullable().catch(null),
  refine: z.number().nullable().catch(null),
  tune: z.array(z.looseObject({ level: z.number().nullable().catch(null) })).catch([]),
  enchant: z
    .looseObject({ status: z.array(z.unknown()).catch([]) })
    .nullable()
    .catch(null)
})

const enchantStatusSchema = z.looseObject({ name: z.string(), value: valueSchema })

const setSchema = z.looseObject({
  setItemId: z.string(),
  setItemName: z.string(),
  setItemRarityName: z.string().nullable().catch(null),
  active: z
    .looseObject({
      setPoint: z
        .looseObject({ current: z.number().nullable().catch(null) })
        .nullable()
        .catch(null)
    })
    .nullable()
    .catch(null)
})

const artifactSchema = z.looseObject({
  slotColor: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  itemRarity: z.string().nullable().catch(null)
})

const equipmentBodySchema = z.looseObject({
  equipment: z.array(z.unknown()).catch([]),
  setItemInfo: z.array(z.unknown()).catch([])
})

const creatureBodySchema = z.looseObject({
  creature: z
    .looseObject({ artifact: z.array(z.unknown()).catch([]) })
    .nullable()
    .catch(null)
})

type EquipmentItem = z.output<typeof equipmentItemSchema>
type SetInfo = z.output<typeof setSchema>
type Artifact = z.output<typeof artifactSchema>

// 형태가 다른 항목 하나 때문에 섹션 전체의 변경점을 잃지 않게 항목마다 따로 읽는다.
function parseEach<T>(schema: z.ZodType<T>, values: readonly unknown[]): T[] {
  return values.flatMap((value) => {
    const parsed = schema.safeParse(value)

    if (!parsed.success) {
      return []
    }

    return [parsed.data]
  })
}

function byKey<T>(values: readonly T[], key: (value: T) => string): Map<string, T> {
  return new Map(values.map((value) => [key(value), value]))
}

function orderedKeys<T>(current: Map<string, T>, previous: Map<string, T>): string[] {
  const added = [...previous.keys()].filter((key) => !current.has(key))

  return [...current.keys(), ...added]
}

function changed(
  field: CharacterFieldChange['field'],
  before: ChangeValue,
  after: ChangeValue,
  name: string | null = null
): CharacterFieldChange[] {
  if (before === after) {
    return []
  }

  return [{ field, name, before, after }]
}

function tuneLevel(item: EquipmentItem): number | null {
  const [tune] = item.tune

  if (tune === undefined) {
    return null
  }

  return tune.level
}

function enchantValues(item: EquipmentItem): Map<string, ChangeValue> {
  const statuses = parseEach(enchantStatusSchema, item.enchant?.status ?? [])

  return new Map(statuses.map(({ name, value }) => [name, value]))
}

// 강화와 증폭은 같은 `reinforce` 칸이고, 증폭 속성 이름이 있으면 증폭이다.
function reinforceChanges(before: EquipmentItem, after: EquipmentItem): CharacterFieldChange[] {
  const amplified = after.amplificationName !== null
  const sameKind = (before.amplificationName !== null) === amplified

  if (sameKind && before.reinforce === after.reinforce) {
    return []
  }

  const field = amplified ? 'amplify' : 'reinforce'

  return [{ field, name: null, before: before.reinforce, after: after.reinforce }]
}

function enchantChanges(before: EquipmentItem, after: EquipmentItem): CharacterFieldChange[] {
  const previous = enchantValues(before)
  const current = enchantValues(after)

  return orderedKeys(current, previous).flatMap((name) =>
    changed('enchant', previous.get(name) ?? null, current.get(name) ?? null, name)
  )
}

function itemFieldChanges(before: EquipmentItem, after: EquipmentItem): CharacterFieldChange[] {
  return [
    ...reinforceChanges(before, after),
    ...changed('refine', before.refine, after.refine),
    ...changed('tune', tuneLevel(before), tuneLevel(after)),
    ...enchantChanges(before, after)
  ]
}

function namedItem(item: ChangedItem): ChangedItem {
  return { itemName: item.itemName, itemRarity: item.itemRarity }
}

function equipmentItemChange(
  before: EquipmentItem | undefined,
  after: EquipmentItem | undefined
): CharacterChangeItem[] {
  const slot = after ?? before

  if (slot === undefined) {
    return []
  }

  const { slotId, slotName } = slot
  const itemName = after?.itemName ?? null
  const itemRarity = after?.itemRarity ?? null

  if (before === undefined || after === undefined || before.itemId !== after.itemId) {
    const replaced = before !== undefined ? namedItem(before) : null

    return [{ kind: 'equipment', slotId, slotName, itemName, itemRarity, replaced, fields: [] }]
  }

  const fields = itemFieldChanges(before, after)

  if (fields.length === 0) {
    return []
  }

  return [{ kind: 'equipment', slotId, slotName, itemName, itemRarity, replaced: null, fields }]
}

function setChange(before: SetInfo | undefined, after: SetInfo | undefined): CharacterChangeItem[] {
  const set = after ?? before

  if (set === undefined) {
    return []
  }

  const fields = [
    ...changed('rarity', before?.setItemRarityName ?? null, after?.setItemRarityName ?? null),
    ...changed(
      'point',
      before?.active?.setPoint?.current ?? null,
      after?.active?.setPoint?.current ?? null
    )
  ]

  if (fields.length === 0) {
    return []
  }

  return [{ kind: 'set', setItemId: set.setItemId, setItemName: set.setItemName, fields }]
}

function equipmentChanges(before: unknown, after: unknown): CharacterChangeItem[] {
  const previous = equipmentBodySchema.parse(before)
  const current = equipmentBodySchema.parse(after)
  const previousItems = byKey(
    parseEach(equipmentItemSchema, previous.equipment),
    (item) => item.slotId
  )
  const currentItems = byKey(
    parseEach(equipmentItemSchema, current.equipment),
    (item) => item.slotId
  )
  const previousSets = byKey(parseEach(setSchema, previous.setItemInfo), (set) => set.setItemId)
  const currentSets = byKey(parseEach(setSchema, current.setItemInfo), (set) => set.setItemId)
  const items = orderedKeys(currentItems, previousItems).flatMap((slotId) =>
    equipmentItemChange(previousItems.get(slotId), currentItems.get(slotId))
  )
  const sets = orderedKeys(currentSets, previousSets).flatMap((setItemId) =>
    setChange(previousSets.get(setItemId), currentSets.get(setItemId))
  )

  return [...items, ...sets]
}

function artifactChange(
  before: Artifact | undefined,
  after: Artifact | undefined
): CharacterChangeItem[] {
  const slot = after ?? before

  if (slot === undefined || before?.itemId === after?.itemId) {
    return []
  }

  const replaced = before !== undefined ? namedItem(before) : null
  const itemName = after?.itemName ?? null
  const itemRarity = after?.itemRarity ?? null

  return [{ kind: 'artifact', slotColor: slot.slotColor, itemName, itemRarity, replaced }]
}

function creatureChanges(before: unknown, after: unknown): CharacterChangeItem[] {
  const previous = creatureBodySchema.parse(before).creature?.artifact ?? []
  const current = creatureBodySchema.parse(after).creature?.artifact ?? []
  const previousArtifacts = byKey(parseEach(artifactSchema, previous), (item) => item.slotColor)
  const currentArtifacts = byKey(parseEach(artifactSchema, current), (item) => item.slotColor)

  return orderedKeys(currentArtifacts, previousArtifacts).flatMap((slotColor) =>
    artifactChange(previousArtifacts.get(slotColor), currentArtifacts.get(slotColor))
  )
}

const sectionDiffs = new Map<string, typeof equipmentChanges>([
  ['equipment', equipmentChanges],
  ['creature', creatureChanges]
])

const sectionOrder: readonly string[] = CHANGE_SECTIONS

/**
 * 섹션 행마다 같은 섹션의 직전 행과 비교한 변경점을 받은 시각별로 묶는다. 첫 기록 시각은 비교 없이 첫 기록으로 두고,
 * 변경점이 없는 시각은 넣지 않는다. 시각은 오래된 순이다.
 */
export function projectCharacterChanges(
  firstObservedAt: Date | null,
  rows: readonly StoredCharacterSection[]
): CharacterChangePoint[] {
  if (firstObservedAt === null) {
    return []
  }

  const first = firstObservedAt.toISOString()
  const points = new Map<string, CharacterChangeItem[][]>()
  const previous = new Map<string, unknown>()
  const ordered = rows.toSorted((left, right) => {
    const byTime = left.observedAt.getTime() - right.observedAt.getTime()

    if (byTime !== 0) {
      return byTime
    }

    return sectionOrder.indexOf(left.section) - sectionOrder.indexOf(right.section)
  })

  for (const { section, observedAt, data } of ordered) {
    const diff = sectionDiffs.get(section)
    const before = previous.get(section)
    previous.set(section, data)

    if (diff === undefined || before === undefined) {
      continue
    }

    const at = observedAt.toISOString()
    const groups = points.get(at) ?? []
    groups.push(diff(before, data))
    points.set(at, groups)
  }

  const changes = [...points].flatMap(([observedAt, groups]) => {
    const items = groups.flat()

    if (observedAt === first || items.length === 0) {
      return []
    }

    return [{ observedAt, first: false, items }]
  })

  return [{ observedAt: first, first: true, items: [] }, ...changes]
}
