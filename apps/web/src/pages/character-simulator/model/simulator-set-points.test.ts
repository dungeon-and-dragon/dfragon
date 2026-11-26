import { oathVariantOf } from '@dfragon/lib/equipment-variants'
import { expect, it } from 'vitest'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import {
  draftOf,
  NO_CHANGES,
  type SimulatorAction,
  type SimulatorChanges,
  type SimulatorSlot,
  simulatorReducer,
  toEquipmentSet,
  toSimulatorRows
} from './simulator-draft'
import { toSimulatorOath } from './simulator-oath'
import { setGradeOf, simulatorSetPointsOf } from './simulator-set-points'

// 딜러 fixture는 소울 페어리 세트 2615점(에픽 방어구 235 다섯, 태초 악세서리 265 셋, 에픽 특수장비 215 셋)과 야망의 용투 서약
// 2780점(태초 본체 655, 완전한 광휘 결정 III 여섯 195, I 175, 0 165, 태초 결정 셋 205)이다.
const DRAGON_SET = 16204

const detail = characterDetailFixture('dealer')
const rows = toSimulatorRows(detail)
const equipmentSet = toEquipmentSet(detail)
const oath = toSimulatorOath(detail)

function apply(...actions: SimulatorAction[]): SimulatorChanges {
  return actions.reduce(simulatorReducer, NO_CHANGES)
}

function slotOf(slotId: string): SimulatorSlot {
  const row = rows.find(
    (candidate) => candidate.kind === 'equipment' && candidate.slot.slotId === slotId
  )

  if (row?.kind !== 'equipment') {
    throw new Error(`no slot ${slotId}`)
  }

  return row.slot
}

function pointsOf(changes: SimulatorChanges) {
  return simulatorSetPointsOf(rows, equipmentSet, oath, changes)
}

it('세트 포인트 구간으로 등급을 정하고 750점 미만은 등급이 없다', () => {
  expect(setGradeOf(2550)).toBe('태초')
  expect(setGradeOf(2549)).toBe('에픽 Ⅴ')
  expect(setGradeOf(2185)).toBe('에픽 Ⅱ')
  expect(setGradeOf(750)).toBe('레어 Ⅰ')
  expect(setGradeOf(749)).toBeNull()
})

it('바꾼 것이 없으면 상세 응답의 세트 포인트와 등급을 그대로 쓴다', () => {
  expect(pointsOf(NO_CHANGES)).toEqual({
    equipment: { point: 2615, rarity: 'primordial' },
    oath: { point: 2780, rarity: 'primordial' }
  })
})

it('서약 본체와 결정을 낮추면 서약 세트 포인트와 등급 색이 따라 바뀌고 장비 세트는 그대로다', () => {
  const epicBody = oathVariantOf(DRAGON_SET, '에픽')!
  const crystalTunes = oath.crystals
    .filter(({ wornTune }) => wornTune > 0)
    .map(
      (crystal): SimulatorAction => ({
        type: 'crystal',
        oath,
        crystal,
        draft: { variantId: crystal.wornVariantId, tune: 0 }
      })
    )
  const changes = apply({ type: 'oathBody', body: oath.body!, id: epicBody.id }, ...crystalTunes)

  // 본체 655 → 455, 결정 III 여섯과 I 하나를 0으로 내려 2780 - 200 - 180 - 10 = 2390점이다.
  expect(pointsOf(changes)).toEqual({
    equipment: { point: 2615, rarity: 'primordial' },
    oath: { point: 2390, rarity: 'epic' }
  })
})

it('장비 세트가 2550점에 모자라면 모자란 만큼 서약 포인트를 끌어온다', () => {
  const jacket = slotOf('JACKET')
  const unique = jacket.variants.find(({ rarity }) => rarity === 'unique')!
  const changes = apply({
    type: 'change',
    slot: jacket,
    draft: { ...draftOf(jacket, NO_CHANGES), variantId: unique.id, tune: 0 }
  })

  // 상의 235 → 115로 장비 2495점이라 55점을 서약에서 끌어온다.
  expect(pointsOf(changes)).toEqual({
    equipment: { point: 2550, rarity: 'primordial' },
    oath: { point: 2725, rarity: 'primordial' }
  })
})

it('묵언의 진의의 서약 포인트 선택지는 하나마다 서약 세트 포인트를 25점 더한다', () => {
  const changes: SimulatorChanges = {
    ...NO_CHANGES,
    oath: { ...NO_CHANGES.oath, upgrade: [{ step: 1, option: '깨어난 서약' }] }
  }

  expect(pointsOf(changes).oath).toEqual({ point: 2805, rarity: 'primordial' })
})
