import type { BuffSwitching } from '@dfragon/lib/buff-switching'
import { z } from 'zod'
import { fromBase64Url, toBase64Url } from '#shared/lib/base64url'
import { BEST_AVATAR_PRESET } from './simulator-avatar'
import {
  draftOf,
  hasChanges,
  NO_CHANGES,
  rowsInEquipmentSet,
  type SimulatorChanges,
  type SimulatorEquipmentSet,
  type SimulatorRow,
  type SimulatorSlot,
  simulatorReducer,
  variantChoiceOf
} from './simulator-draft'
import { oathInSet, type SimulatorOath } from './simulator-oath'

const slotDraftSchema = z.object({
  reinforce: z.number(),
  amplified: z.boolean(),
  enchantId: z.string().nullable(),
  variantId: z.string().nullable(),
  tune: z.number(),
  potency: z.number().nullable(),
  release: z.number().nullable()
})

// SimulatorChanges에 필드가 늘면 z.object가 그 키를 버려 공유한 주소에서 값만 빠지므로, 출력 타입이 맞는지 컴파일 때 확인한다.
const savedChangesSchema = z.object({
  equipmentSet: z.string().nullable(),
  equipment: z.record(z.string(), slotDraftSchema),
  slotItems: z.record(z.string(), z.string()),
  avatarPreset: z.literal(BEST_AVATAR_PRESET).nullable(),
  buffLevel: z.number().nullable(),
  switchingEquipment: z.number().nullable(),
  oath: z.object({
    set: z.number().nullable(),
    body: z.string().nullable(),
    crystals: z.record(
      z.string(),
      z.object({ variantId: z.string().nullable(), tune: z.number() })
    ),
    upgrade: z.array(z.object({ step: z.number(), option: z.string() })).nullable()
  })
}) satisfies z.ZodType<SimulatorChanges>

const searchSchema = z.object({
  changes: z.string().optional().catch(undefined)
})

type SavedChanges = z.infer<typeof savedChangesSchema>
type SavedSlotDraft = z.infer<typeof slotDraftSchema>
type SavedUpgrade = NonNullable<SavedChanges['oath']['upgrade']>

export type SimulatorSearch = Readonly<{ changes?: string | undefined }>

export type RestoreContext = Readonly<{
  wornRows: readonly SimulatorRow[]
  equipmentSet: SimulatorEquipmentSet
  wornOath: SimulatorOath
  avatarPresetAvailable: boolean
  switching: BuffSwitching | null
}>

// 라우터는 상위 route가 받은 원래 search 위에 이 결과를 덮으므로, 문자열이 아닌 값도 undefined로 덮어 버린다.
export function parseSimulatorSearch(search: Record<string, unknown>): SimulatorSearch {
  const { changes } = searchSchema.parse(search)

  return { changes }
}

export function encodeChanges(changes: SimulatorChanges): string | undefined {
  if (!hasChanges(changes)) {
    return undefined
  }

  return toBase64Url(JSON.stringify(changes))
}

function decodeChanges(saved: string): SavedChanges | null {
  let json: unknown

  // 주소창에서 고친 값처럼 읽을 수 없는 값은 버리고 착용한 상태로 연다.
  try {
    json = JSON.parse(fromBase64Url(saved))
  } catch {
    return null
  }

  const parsed = savedChangesSchema.safeParse(json)

  if (!parsed.success) {
    return null
  }

  return parsed.data
}

// 마법부여 선택지는 따로 받아 아직 없을 수 있다. 고른 id는 그대로 두고, 받은 선택지에 없으면 draftOf가 착용한 마법부여로 되돌린다.
function withEnchant(
  changes: SimulatorChanges,
  slot: SimulatorSlot,
  enchantId: string
): SimulatorChanges {
  const draft = draftOf(slot, changes)

  if (slot.empty && variantChoiceOf(slot, draft.variantId) === undefined) {
    return changes
  }

  return { ...changes, equipment: { ...changes.equipment, [slot.slotId]: { ...draft, enchantId } } }
}

function restoreSlot(
  changes: SimulatorChanges,
  slot: SimulatorSlot,
  saved: SavedSlotDraft | undefined
): SimulatorChanges {
  if (saved === undefined) {
    return changes
  }

  const { enchantId, ...draft } = saved
  const restored = simulatorReducer(changes, { type: 'change', slot, draft })

  if (enchantId === null) {
    return restored
  }

  return withEnchant(restored, slot, enchantId)
}

function restoreRows(
  changes: SimulatorChanges,
  rows: readonly SimulatorRow[],
  saved: SavedChanges
): SimulatorChanges {
  return rows.reduce((restored, row) => {
    if (row.kind === 'equipment') {
      return restoreSlot(restored, row.slot, saved.equipment[row.slot.slotId])
    }

    const id = saved.slotItems[row.slotItem.category]

    if (id === undefined) {
      return restored
    }

    // 칭호, 크리쳐, 오라 선택지도 실험실 목록에서 따로 받아 아직 없을 수 있어, 고른 id를 그대로 두고 slotItemChoiceOf가 거른다.
    const slotItems = { ...restored.slotItems, [row.slotItem.category]: id }

    return { ...restored, slotItems }
  }, changes)
}

// 화면에서는 착용한 진의 앞부분을 남기고 그 뒤를 기본 선택지로 해금하는 것만 만들 수 있어, 같은 순서로 풀고 다시 해금한다.
function restoreUpgrade(
  changes: SimulatorChanges,
  oath: SimulatorOath,
  saved: SavedUpgrade | null
): SimulatorChanges {
  if (saved === null || oath.upgrade === null) {
    return changes
  }

  const { upgrade } = oath
  const differs = upgrade.worn.findIndex(
    ({ step, option }, index) => saved[index]?.step !== step || saved[index]?.option !== option
  )

  const keptLength = differs === -1 ? upgrade.worn.length : differs
  const lowered = simulatorReducer(changes, {
    type: 'oathUpgradeUnlock',
    upgrade,
    step: keptLength + 1,
    unlocked: false
  })

  if (saved.length <= keptLength) {
    return lowered
  }

  return simulatorReducer(lowered, {
    type: 'oathUpgradeUnlock',
    upgrade,
    step: saved.length,
    unlocked: true
  })
}

function restoreOath(
  changes: SimulatorChanges,
  wornOath: SimulatorOath,
  saved: SavedChanges['oath']
): SimulatorChanges {
  const withSet =
    saved.set !== null
      ? simulatorReducer(changes, { type: 'oathSet', oath: wornOath, setId: saved.set })
      : changes

  const body = oathInSet(wornOath, withSet.oath.set).body
  const withBody =
    saved.body !== null && body !== null
      ? simulatorReducer(withSet, { type: 'oathBody', body, id: saved.body })
      : withSet

  // 서약이 없는 캐릭터는 본체를 고르면 서약 세트도 바뀌므로, 결정은 본체까지 고른 세트에서 찾는다.
  const oath = oathInSet(wornOath, withBody.oath.set)
  const withCrystals = oath.crystals.reduce((restored, crystal) => {
    const draft = saved.crystals[crystal.slotNo]

    if (draft === undefined) {
      return restored
    }

    return simulatorReducer(restored, { type: 'crystal', oath, crystal, draft })
  }, withBody)

  return restoreUpgrade(withCrystals, oath, saved.upgrade)
}

function restoreEtc(
  changes: SimulatorChanges,
  context: RestoreContext,
  saved: SavedChanges
): SimulatorChanges {
  const { avatarPresetAvailable, switching } = context
  const withAvatar =
    saved.avatarPreset !== null && avatarPresetAvailable
      ? simulatorReducer(changes, { type: 'avatarPreset', preset: saved.avatarPreset })
      : changes

  if (switching === null) {
    return withAvatar
  }

  const withBuffLevel =
    saved.buffLevel !== null
      ? simulatorReducer(withAvatar, { type: 'buffLevel', switching, level: saved.buffLevel })
      : withAvatar

  if (saved.switchingEquipment === null) {
    return withBuffLevel
  }

  return simulatorReducer(withBuffLevel, {
    type: 'switchingEquipment',
    switching,
    count: saved.switchingEquipment
  })
}

/**
 * 주소에 남긴 변경을 화면에서 고르는 것과 같은 순서로 다시 적용한다. 그 캐릭터가 장비를 바꿨거나 선택 목록이 바뀌어 고를 수 없게 된
 * 값은 버려 착용한 값으로 둔다.
 */
export function restoreChanges(
  context: RestoreContext,
  saved: string | undefined
): SimulatorChanges {
  const decoded = saved !== undefined ? decodeChanges(saved) : null

  if (decoded === null) {
    return NO_CHANGES
  }

  const { wornRows, equipmentSet, wornOath } = context
  const withSet =
    decoded.equipmentSet !== null
      ? simulatorReducer(NO_CHANGES, {
          type: 'equipmentSet',
          rows: wornRows,
          equipmentSet,
          setItemId: decoded.equipmentSet
        })
      : NO_CHANGES

  const rows = rowsInEquipmentSet(wornRows, withSet.equipmentSet)
  const withRows = restoreRows(withSet, rows, decoded)
  const withOath = restoreOath(withRows, wornOath, decoded.oath)

  return restoreEtc(withOath, context, decoded)
}
