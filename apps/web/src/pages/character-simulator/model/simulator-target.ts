import type {
  SimulatorOathCrystal,
  SimulatorRow,
  SimulatorSlot,
  SimulatorSlotItem
} from './simulator-draft'

/** 장비창에서 골라 조작 패널에 여는 한 줄이다. key는 화면 안에서 줄마다 다르다. */
export type SimulatorTarget =
  | Readonly<{ kind: 'equipment'; key: string; slot: SimulatorSlot }>
  | Readonly<{ kind: 'slotItem'; key: string; slotItem: SimulatorSlotItem }>
  | Readonly<{ kind: 'oath'; key: string; crystal: SimulatorOathCrystal }>

function rowTarget(row: SimulatorRow): SimulatorTarget {
  if (row.kind === 'slotItem') {
    const { slotItem } = row

    return { kind: 'slotItem', key: `slotItem:${slotItem.category}`, slotItem }
  }

  const { slot } = row

  return { kind: 'equipment', key: `equipment:${slot.slotId}`, slot }
}

function oathTarget(crystal: SimulatorOathCrystal): SimulatorTarget {
  return { kind: 'oath', key: `oath:${crystal.slotNo}`, crystal }
}

export function toSimulatorTargets(
  rows: readonly SimulatorRow[],
  crystals: readonly SimulatorOathCrystal[]
): SimulatorTarget[] {
  return [...rows.map(rowTarget), ...crystals.map(oathTarget)]
}

export function selectedTargetOf(
  targets: readonly SimulatorTarget[],
  key: string | null
): SimulatorTarget | undefined {
  const selected = targets.find((target) => target.key === key)

  if (selected === undefined) {
    return targets[0]
  }

  return selected
}

export function targetTitleOf(target: SimulatorTarget): string {
  switch (target.kind) {
    case 'equipment': {
      const { slotName, slotId } = target.slot

      if (slotName === null) {
        return slotId
      }

      return slotName
    }
    case 'slotItem':
      return target.slotItem.slotName
    case 'oath':
      return '서약 결정'
  }
}
