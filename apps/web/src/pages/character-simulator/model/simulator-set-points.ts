import {
  findEquipmentVariant,
  findOathCrystal,
  findOathCrystalVariant,
  findOathUpgradeOption,
  findOathVariant
} from '@dfragon/lib/equipment-variants'
import { type ItemView, itemRarityOfGrade } from '#entities/character'
import {
  draftOf,
  hasChanges,
  type SimulatorChanges,
  type SimulatorEquipmentSet,
  type SimulatorRow,
  variantChoiceOf
} from './simulator-draft'
import { crystalDraftOf, crystalItemOf, oathBodyItemOf, type SimulatorOath } from './simulator-oath'
import { upgradeOf } from './simulator-oath-upgrade'

// 장비 세트가 이 포인트에 모자라면 그만큼 서약 포인트에서 끌어온다(보정 포인트).
const MAIN_SET_TARGET = 2550
// 묵언의 진의의 서약 포인트 선택지 하나가 서약 세트 포인트에 더하는 값이다.
const UPGRADE_OATH_POINT = 25
const WEAPON_SLOT_ID = 'WEAPON'

// 장비와 서약 세트가 같은 구간을 쓴다(운영 응답의 setPoint.min, 2026-11-26). 750점 미만은 세트 효과가 없다.
const SET_GRADES: readonly (readonly [number, string])[] = [
  [2550, '태초'],
  [2440, '에픽 Ⅴ'],
  [2355, '에픽 Ⅳ'],
  [2270, '에픽 Ⅲ'],
  [2185, '에픽 Ⅱ'],
  [2100, '에픽 Ⅰ'],
  [1990, '레전더리 Ⅴ'],
  [1905, '레전더리 Ⅳ'],
  [1820, '레전더리 Ⅲ'],
  [1735, '레전더리 Ⅱ'],
  [1650, '레전더리 Ⅰ'],
  [1540, '유니크 Ⅴ'],
  [1455, '유니크 Ⅳ'],
  [1370, '유니크 Ⅲ'],
  [1285, '유니크 Ⅱ'],
  [1200, '유니크 Ⅰ'],
  [1070, '레어 Ⅴ'],
  [990, '레어 Ⅳ'],
  [910, '레어 Ⅲ'],
  [830, '레어 Ⅱ'],
  [750, '레어 Ⅰ']
]

export type SetPointView = Readonly<{ point: number; rarity: ItemView['rarity'] }>

export type SimulatorSetPoints = Readonly<{
  equipment: SetPointView | null
  oath: SetPointView | null
}>

type PointPart = Readonly<{ setKey: string | null; point: number }>

export function setGradeOf(point: number): string | null {
  const grade = SET_GRADES.find(([min]) => point >= min)

  if (grade === undefined) {
    return null
  }

  return grade[1]
}

function pointAt(tuneSetPoints: readonly number[], tune: number): number {
  return tuneSetPoints[Math.min(tune, tuneSetPoints.length - 1)]!
}

function equipmentParts(rows: readonly SimulatorRow[], changes: SimulatorChanges): PointPart[] {
  return rows.flatMap((row): PointPart[] => {
    if (row.kind !== 'equipment' || row.slot.slotId === WEAPON_SLOT_ID) {
      return []
    }

    const { slot } = row
    const draft = draftOf(slot, changes)
    const variant = variantChoiceOf(slot, draft.variantId)?.variant

    if (variant != null) {
      const setKey = findEquipmentVariant(variant.id)?.setItemId ?? null
      const point = pointAt(variant.tuneSetPoints, draft.tune)

      return [{ setKey, point }]
    }

    if (slot.wornSetPoint === null) {
      return []
    }

    return [{ setKey: slot.wornSetItemId, point: slot.wornSetPoint }]
  })
}

function oathParts(oath: SimulatorOath, changes: SimulatorChanges): PointPart[] {
  const body = oath.body !== null ? oathBodyItemOf(oath.body, changes.oath) : null
  const bodyMatch = body?.itemId != null ? findOathVariant(body.itemId) : null
  const bodySetKey = bodyMatch?.setId?.toString() ?? null
  const bodyParts =
    bodyMatch !== null ? [{ setKey: bodySetKey, point: bodyMatch.variant.setPoint }] : []
  const crystalParts = oath.crystals.flatMap((crystal): PointPart[] => {
    const item = crystalItemOf(crystal, changes.oath)
    const { tune } = crystalDraftOf(crystal, changes.oath)
    const match = item.itemId !== null ? findOathCrystalVariant(item.itemId) : null

    if (match !== null) {
      const setKey = match.setId.toString()
      const point = pointAt(match.variant.tuneSetPoints, tune)

      return [{ setKey, point }]
    }

    const known = item.itemName !== null ? findOathCrystal(item.itemName) : null

    if (known === null) {
      return []
    }

    const point = pointAt(known.tuneSetPoints, tune)

    return [{ setKey: null, point }]
  })

  return [...bodyParts, ...crystalParts]
}

function mainSetPointOf(parts: readonly PointPart[]): number | null {
  const keyed = new Map<string, number>()
  let unkeyed = 0

  for (const { setKey, point } of parts) {
    if (setKey === null) {
      unkeyed += point
    } else {
      keyed.set(setKey, (keyed.get(setKey) ?? 0) + point)
    }
  }

  if (keyed.size === 0) {
    return null
  }

  return Math.max(...keyed.values()) + unkeyed
}

function upgradeOathPointOf(oath: SimulatorOath, changes: SimulatorChanges): number {
  if (oath.upgrade === null) {
    return 0
  }

  const picked = upgradeOf(oath.upgrade, changes.oath.upgrade).filter(
    ({ step, option }) => findOathUpgradeOption(step, option)?.kind === 'Oathpoint'
  )

  return picked.length * UPGRADE_OATH_POINT
}

function toView(point: number): SetPointView {
  const rarity = itemRarityOfGrade(setGradeOf(point))

  return { point, rarity }
}

function wornView(point: number | null, rarity: ItemView['rarity']): SetPointView | null {
  if (point === null) {
    return null
  }

  return { point, rarity }
}

export function simulatorSetPointsOf(
  rows: readonly SimulatorRow[],
  equipmentSet: SimulatorEquipmentSet,
  oath: SimulatorOath | null,
  changes: SimulatorChanges
): SimulatorSetPoints {
  if (!hasChanges(changes)) {
    const equipment = wornView(equipmentSet.point, equipmentSet.rarity)
    const wornOath = oath !== null ? wornView(oath.point, oath.rarity) : null

    return { equipment, oath: wornOath }
  }

  const equipmentRaw = mainSetPointOf(equipmentParts(rows, changes))
  const oathRaw = oath !== null ? (mainSetPointOf(oathParts(oath, changes)) ?? 0) : 0
  const deficit = Math.max(0, MAIN_SET_TARGET - (equipmentRaw ?? 0))
  const transfer = Math.min(oathRaw, deficit)
  const equipment = equipmentRaw !== null ? toView(equipmentRaw + transfer) : null
  const upgradePoint = oath !== null ? upgradeOathPointOf(oath, changes) : 0
  const oathPoint = oathRaw - transfer + upgradePoint
  const oathView = oath !== null && oathRaw > 0 ? toView(oathPoint) : null

  return { equipment, oath: oathView }
}
