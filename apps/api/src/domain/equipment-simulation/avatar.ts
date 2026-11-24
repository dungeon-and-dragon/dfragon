import {
  AVATAR_PRESET_PARTS,
  type AvatarEmblem,
  type AvatarEmblemColor,
  type AvatarPreset,
  type AvatarPresetPartSpec,
  findAvatarPreset
} from '@dfragon/lib/avatar-presets'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type {
  CharacterPayload,
  CharacterPayloads
} from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterRole } from '@dfragon/server-core/domain/character-role.js'
import { EquipmentSimulationFailure } from './failure.js'

export type AvatarPresetChoice = 'best'

const PLATINUM_COLOR = '플래티넘'

interface AuraEdit {
  readonly original: CharacterPayload
  readonly emblems: readonly CharacterPayload[]
  readonly itemIds: readonly string[]
}

export interface AvatarEdit {
  readonly parts: readonly CharacterPayload[]
  /** 오라를 끼지 않았거나 오라 엠블렘이 이미 끝 스펙이면 null이다. */
  readonly aura: AuraEdit | null
  /** 엔진이 상세를 `items`에서 읽어야 하는 엠블렘이다. */
  readonly itemIds: readonly string[]
}

interface EmblemsEdit {
  readonly emblems: CharacterPayload[]
  readonly changed: boolean
  readonly itemIds: string[]
}

function avatarsOf(payloads: CharacterPayloads): Map<unknown, CharacterPayload> {
  const { avatar } = payloads.avatar

  if (!Array.isArray(avatar)) {
    return new Map()
  }

  return new Map(avatar.filter(isRecord).map((item) => [item.slotId, item]))
}

function emblemsOf(item: CharacterPayload): CharacterPayload[] {
  if (!Array.isArray(item.emblems)) {
    return []
  }

  return item.emblems.filter(isRecord)
}

function presetOf(payloads: CharacterPayloads, role: CharacterRole | null): AvatarPreset {
  const { jobId, jobGrowId } = payloads.basic
  const presetRole = role === 'buffer' ? 'buffer' : 'dealer'
  const preset =
    typeof jobId === 'string' && typeof jobGrowId === 'string'
      ? findAvatarPreset({ jobId, jobGrowId }, presetRole)
      : null

  if (preset === null) {
    throw new EquipmentSimulationFailure('request')
  }

  return preset
}

function emblemPayload(emblem: AvatarEmblem): CharacterPayload {
  const { slotNo, slotColor, itemId, itemName, itemRarity } = emblem

  return { slotNo, slotColor, itemId, itemName, itemRarity }
}

// 같은 소켓에 같은 이름의 엠블렘을 이미 끼고 있으면 원본 항목을 그대로 둬 상세를 다시 받지 않는다.
function fillEmblems(
  original: readonly CharacterPayload[],
  targets: readonly AvatarEmblem[]
): EmblemsEdit {
  const originalIds = new Set(original.map(({ itemId }) => itemId))
  const itemIds: string[] = []
  const emblems = targets.map((target) => {
    const worn = original.find(({ slotNo }) => slotNo === target.slotNo)

    if (worn?.slotColor === target.slotColor && worn.itemName === target.itemName) {
      return worn
    }

    if (!originalIds.has(target.itemId)) {
      itemIds.push(target.itemId)
    }

    // 엔진은 바뀐 플래티넘의 스탯 차이를 원본 플래티넘 상세로 구한다.
    if (worn?.slotColor === PLATINUM_COLOR && typeof worn.itemId === 'string') {
      itemIds.push(worn.itemId)
    }

    return emblemPayload(target)
  })
  const changed =
    emblems.length !== original.length ||
    emblems.some((emblem, index) => emblem !== original[index])

  return { emblems, changed, itemIds }
}

interface PartEdit {
  readonly part: CharacterPayload
  readonly itemIds: readonly string[]
}

function addedPart(spec: AvatarPresetPartSpec): PartEdit {
  const { slotId, slotName, itemName, itemRarity, optionAbility } = spec
  const emblems = spec.emblems.map(emblemPayload)
  const itemIds = spec.emblems.map(({ itemId }) => itemId)

  return { part: { slotId, slotName, itemName, itemRarity, optionAbility, emblems }, itemIds }
}

// 엔진은 원본 부위의 등급, 옵션, 엠블렘만 바꿀 수 있으므로 원본을 복사해 그 칸만 바꾼다.
function presetPart(original: CharacterPayload, spec: AvatarPresetPartSpec): PartEdit | null {
  const filled = fillEmblems(emblemsOf(original), spec.emblems)
  const changed =
    filled.changed ||
    original.itemRarity !== spec.itemRarity ||
    original.optionAbility !== spec.optionAbility

  if (!changed) {
    return null
  }

  const part = structuredClone(original)
  part.itemRarity = spec.itemRarity
  part.optionAbility = spec.optionAbility
  part.emblems = filled.emblems

  return { part, itemIds: filled.itemIds }
}

function isEmblemColor(preset: AvatarPreset, slotColor: unknown): slotColor is AvatarEmblemColor {
  return typeof slotColor === 'string' && Object.hasOwn(preset.emblems, slotColor)
}

// 오라는 아이템을 `aura` 교체가 정하므로 소켓 배열을 그대로 두고 색마다 찬란한 엠블렘만 넣는다.
function auraEditOf(preset: AvatarPreset, aura: CharacterPayload | undefined): AuraEdit | null {
  if (aura === undefined) {
    return null
  }

  const original = emblemsOf(aura)
  const targets = original.flatMap(({ slotNo, slotColor }) => {
    if (typeof slotNo !== 'number' || !isEmblemColor(preset, slotColor)) {
      return []
    }

    return [{ slotNo, slotColor, ...preset.emblems[slotColor] }]
  })

  if (targets.length !== original.length) {
    return null
  }

  const { emblems, changed, itemIds } = fillEmblems(original, targets)

  if (!changed) {
    return null
  }

  return { original: aura, emblems, itemIds }
}

function partEditOf(original: CharacterPayload | undefined, spec: AvatarPresetPartSpec) {
  if (original === undefined) {
    return addedPart(spec)
  }

  return presetPart(original, spec)
}

/**
 * 원본의 무기와 8부위, 오라 엠블렘을 끝 스펙으로 바꾼다. 피부, 오라 스킨과 버프 강화에 등록한 아바타는 두고,
 * 끝 스펙 표에 없는 전직은 거절한다.
 */
export function editAvatar(
  payloads: CharacterPayloads,
  role: CharacterRole | null,
  choice: AvatarPresetChoice | null
): AvatarEdit | null {
  if (choice === null) {
    return null
  }

  const preset = presetOf(payloads, role)
  const worn = avatarsOf(payloads)
  const partEdits = AVATAR_PRESET_PARTS.flatMap((slotId) => {
    const edit = partEditOf(worn.get(slotId), preset.parts[slotId])

    if (edit === null) {
      return []
    }

    return [edit]
  })
  const aura = auraEditOf(preset, worn.get('AURORA'))
  const parts = partEdits.map(({ part }) => part)
  const auraItemIds = aura?.itemIds ?? []
  const itemIds = [...new Set([...partEdits.flatMap(({ itemIds }) => itemIds), ...auraItemIds])]

  return { parts, aura, itemIds }
}

export function hasAvatarEdit(edit: AvatarEdit | null): boolean {
  return edit !== null && (edit.parts.length > 0 || edit.aura !== null)
}

export function avatarItemIds(edit: AvatarEdit | null): readonly string[] {
  if (edit === null) {
    return []
  }

  return edit.itemIds
}

function simulatedAura(
  edit: AvatarEdit | null,
  aura: CharacterPayload | null
): CharacterPayload | null {
  const auraEdit = edit?.aura ?? null

  if (auraEdit === null) {
    return aura
  }

  const simulated = structuredClone(aura ?? auraEdit.original)
  simulated.emblems = auraEdit.emblems

  return simulated
}

/** 엔진 `simulation.avatar` 목록이다. aura는 `aura` 교체로 바꾼 오라 항목이다. */
export function simulatedAvatar(
  edit: AvatarEdit | null,
  aura: CharacterPayload | null
): CharacterPayload[] {
  const parts = edit?.parts ?? []
  const simulated = simulatedAura(edit, aura)

  if (simulated === null) {
    return [...parts]
  }

  return [...parts, simulated]
}
