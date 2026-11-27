import assert from 'node:assert/strict'
import test from 'node:test'
import { recoverEpicSouls } from '@dfragon/lib/epic-soul-recovery'

// 선택지 목록(equipment-variants.json)에 있는 실제 itemId다.
const EPIC_GREATSWORD = '49d73ddb4974cc8ee23c0da2e253cf2a'
const LEGENDARY_GREATSWORD = 'd978ce202804d10c1970bab4b46accd8'
const EPIC_JACKET = '712eef49bfaeef17d21b4d984b6c28b0'
const SCOURGE_JACKET = '82167cd052bfb6f3b8f3017a941da668'
const CONSECRATED_JACKET_NAME_ITEM = 'ce653434e129a67945878c1c2e66ce73'
const LEGENDARY_JACKET = 'c28adff4d999079e03626b5b04f0a7cc'
const EPIC_AMULET = 'b56f1b34f0cd04e060ed954df3d638d8'
const PRIMEVAL_AMULET = 'ce90fd8107a2dec651b9f7c41a84888c'
const EXALTED_RING = 'aa5273499f19ddba846919dbb6857d82'

test('3조율 에픽 무기는 46개, 2조율 에픽 상의는 21개를 돌려받아 합이 67개다', () => {
  const recovery = recoverEpicSouls([
    { slotId: 'WEAPON', itemId: EPIC_GREATSWORD, tune: 3 },
    { slotId: 'JACKET', itemId: EPIC_JACKET, tune: 2 }
  ])

  assert.deepEqual(recovery, {
    total: 67,
    slots: [
      { slotId: 'WEAPON', itemId: EPIC_GREATSWORD, tune: 3, souls: 46 },
      { slotId: 'JACKET', itemId: EPIC_JACKET, tune: 2, souls: 21 }
    ]
  })
})

test('잠식 에픽도 조율하지 않았으면 1개를 돌려받는다', () => {
  const recovery = recoverEpicSouls([{ slotId: 'JACKET', itemId: SCOURGE_JACKET, tune: 0 }])

  assert.equal(recovery.total, 1)
})

test('5축성 공용 이름 아이템은 그 부위에 끼었을 때 축성 에픽으로 센다', () => {
  const recovery = recoverEpicSouls([
    { slotId: 'JACKET', itemId: CONSECRATED_JACKET_NAME_ITEM, tune: 1 }
  ])

  assert.equal(recovery.total, 11)
})

test('레전더리, 태초, 유일 장비와 목록 밖 아이템은 회수하지 않는다', () => {
  const recovery = recoverEpicSouls([
    { slotId: 'WEAPON', itemId: LEGENDARY_GREATSWORD, tune: 3 },
    { slotId: 'JACKET', itemId: LEGENDARY_JACKET, tune: 2 },
    { slotId: 'AMULET', itemId: PRIMEVAL_AMULET, tune: 3 },
    { slotId: 'RING', itemId: EXALTED_RING, tune: 0 },
    { slotId: 'EARRING', itemId: 'not-listed', tune: 3 },
    { slotId: 'TITLE', itemId: EPIC_AMULET, tune: 0 }
  ])

  assert.deepEqual(recovery, { total: 0, slots: [] })
})
