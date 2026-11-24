import type { BuffSwitching } from '@dfragon/lib/buff-switching'
import type {
  SimulatorEquipmentSet,
  SimulatorRow,
  SimulatorSlot,
  SimulatorSlotItem
} from './simulator-draft'
import type { SimulatorOath, SimulatorOathBody, SimulatorOathCrystal } from './simulator-oath'
import type { SimulatorOathUpgrade } from './simulator-oath-upgrade'

/** 장비창에서 골라 조작 패널에 여는 한 줄이다. key는 화면 안에서 줄마다 다르다. */
export type SimulatorTarget =
  | Readonly<{ kind: 'equipmentSet'; key: string; equipmentSet: SimulatorEquipmentSet }>
  | Readonly<{ kind: 'equipment'; key: string; slot: SimulatorSlot }>
  | Readonly<{ kind: 'slotItem'; key: string; slotItem: SimulatorSlotItem }>
  | Readonly<{ kind: 'avatar'; key: string }>
  | Readonly<{ kind: 'switching'; key: string; switching: BuffSwitching }>
  | Readonly<{ kind: 'oathSet'; key: string; oath: SimulatorOath }>
  | Readonly<{ kind: 'oathBody'; key: string; body: SimulatorOathBody }>
  | Readonly<{ kind: 'oathUpgrade'; key: string; upgrade: SimulatorOathUpgrade }>
  | Readonly<{ kind: 'crystal'; key: string; crystal: SimulatorOathCrystal }>

function rowTarget(row: SimulatorRow): SimulatorTarget {
  if (row.kind === 'slotItem') {
    const { slotItem } = row

    return { kind: 'slotItem', key: `slotItem:${slotItem.category}`, slotItem }
  }

  const { slot } = row

  return { kind: 'equipment', key: `equipment:${slot.slotId}`, slot }
}

function equipmentSetTargets(equipmentSet: SimulatorEquipmentSet | null): SimulatorTarget[] {
  if (equipmentSet === null) {
    return []
  }

  return [{ kind: 'equipmentSet', key: 'equipmentSet', equipmentSet }]
}

function avatarTargets(avatarPresetAvailable: boolean): SimulatorTarget[] {
  if (!avatarPresetAvailable) {
    return []
  }

  return [{ kind: 'avatar', key: 'avatar' }]
}

function switchingTargets(switching: BuffSwitching | null): SimulatorTarget[] {
  if (switching === null) {
    return []
  }

  return [{ kind: 'switching', key: 'switching', switching }]
}

function oathTargets(oath: SimulatorOath | null): SimulatorTarget[] {
  if (oath === null) {
    return []
  }

  const setTargets: SimulatorTarget[] =
    oath.setId !== null ? [{ kind: 'oathSet', key: 'oathSet', oath }] : []
  const bodyTargets: SimulatorTarget[] =
    oath.body !== null ? [{ kind: 'oathBody', key: 'oathBody', body: oath.body }] : []
  const upgradeTargets: SimulatorTarget[] =
    oath.upgrade !== null
      ? [{ kind: 'oathUpgrade', key: 'oathUpgrade', upgrade: oath.upgrade }]
      : []
  const crystalTargets = oath.crystals.map(
    (crystal): SimulatorTarget => ({ kind: 'crystal', key: `crystal:${crystal.slotNo}`, crystal })
  )

  return [...setTargets, ...bodyTargets, ...upgradeTargets, ...crystalTargets]
}

/**
 * 장비창의 줄 순서대로 장비 세트, 장비, 칭호, 크리쳐, 오라, 아바타, 스위칭 뒤에 서약 세트, 서약 본체, 진의, 서약 결정을
 * 둔다.
 */
export function toSimulatorTargets(
  equipmentSet: SimulatorEquipmentSet | null,
  rows: readonly SimulatorRow[],
  avatarPresetAvailable: boolean,
  switching: BuffSwitching | null,
  oath: SimulatorOath | null
): SimulatorTarget[] {
  return [
    ...equipmentSetTargets(equipmentSet),
    ...rows.map(rowTarget),
    ...avatarTargets(avatarPresetAvailable),
    ...switchingTargets(switching),
    ...oathTargets(oath)
  ]
}

export function isOathTarget(target: SimulatorTarget): boolean {
  return (
    target.kind === 'oathSet' ||
    target.kind === 'oathBody' ||
    target.kind === 'oathUpgrade' ||
    target.kind === 'crystal'
  )
}

/** 고른 줄이 없거나 사라졌으면 첫 장비 부위를 연다. */
export function selectedTargetOf(
  targets: readonly SimulatorTarget[],
  key: string | null
): SimulatorTarget | undefined {
  const selected = targets.find((target) => target.key === key)

  if (selected !== undefined) {
    return selected
  }

  const firstSlot = targets.find((target) => target.kind === 'equipment')

  if (firstSlot === undefined) {
    return targets[0]
  }

  return firstSlot
}

export function targetTitleOf(target: SimulatorTarget): string {
  switch (target.kind) {
    case 'equipmentSet':
      return '장비 세트'
    case 'equipment': {
      const { slotName, slotId } = target.slot

      if (slotName === null) {
        return slotId
      }

      return slotName
    }
    case 'slotItem':
      return target.slotItem.slotName
    case 'avatar':
      return '아바타'
    case 'switching':
      return '스위칭'
    case 'oathSet':
      return '서약 세트'
    case 'oathBody':
      return '서약'
    case 'oathUpgrade':
      return target.upgrade.title
    case 'crystal':
      return '서약 결정'
  }
}
