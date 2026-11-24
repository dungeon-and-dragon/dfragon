import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buffSwitchingOf,
  isSelectableBuffLevel,
  isSelectableSwitchingEquipment,
  selectableBuffLevels
} from '@dfragon/lib/buff-switching'

const SKILL_ID = 'ab6fc3303df03b58911967dfca2b5d07'

function buffOf(name, level, skillId = SKILL_ID) {
  return { skillInfo: { skillId, name, option: { level, desc: '', values: [] } } }
}

function skillStyleOf(level, skillId = SKILL_ID) {
  return {
    style: {
      active: [{ skillId, name: '하악질', level }],
      passive: [{ skillId: 'other', name: '다른 스킬', level: 1 }]
    }
  }
}

function dealer(buffLevel, learnedLevel) {
  return {
    role: 'dealer',
    jobName: '아처',
    buff: buffOf('하악질', buffLevel),
    skillStyle: skillStyleOf(learnedLevel)
  }
}

test('딜러는 배운 레벨부터 10레벨 위까지 고를 수 있다', () => {
  const switching = buffSwitchingOf(dealer(20, 13))

  assert.deepEqual(switching, {
    skillName: '하악질',
    level: 20,
    min: 13,
    max: 23,
    equipment: { count: 0, max: 12 }
  })
  assert.equal(isSelectableBuffLevel(switching, 13), true)
  assert.equal(isSelectableBuffLevel(switching, 23), true)
  assert.equal(isSelectableBuffLevel(switching, 12), false)
  assert.equal(isSelectableBuffLevel(switching, 24), false)
  assert.equal(isSelectableBuffLevel(switching, 15.5), false)
  assert.deepEqual(selectableBuffLevels(switching), [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])
})

test('지금 레벨이 범위 밖이면 그 레벨도 고를 수 있다', () => {
  const switching = buffSwitchingOf(dealer(26, 13))

  assert.equal(isSelectableBuffLevel(switching, 26), true)
  assert.equal(isSelectableBuffLevel(switching, 25), false)
  assert.deepEqual(selectableBuffLevels(switching).slice(-2), [23, 26])
})

test('버퍼는 주 버프를 등록했을 때 10~33레벨을 고를 수 있다', () => {
  const switching = buffSwitchingOf({
    role: 'buffer',
    jobName: '프리스트(여)',
    buff: buffOf('용맹의 축복', 34),
    skillStyle: null
  })

  assert.deepEqual(switching, {
    skillName: '용맹의 축복',
    level: 34,
    min: 10,
    max: 33,
    equipment: null
  })
  assert.equal(isSelectableBuffLevel(switching, 9), false)
  assert.equal(isSelectableBuffLevel(switching, 10), true)
  assert.equal(isSelectableBuffLevel(switching, 33), true)
  assert.equal(isSelectableBuffLevel(switching, 34), true)
  assert.equal(isSelectableBuffLevel(switching, 35), false)
  assert.deepEqual(
    selectableBuffLevels(switching),
    Array.from({ length: 25 }, (_, index) => index + 10)
  )
})

test('주 버프가 아닌 스킬을 등록한 버퍼는 레벨을 바꿀 수 없다', () => {
  const source = {
    role: 'buffer',
    jobName: '프리스트(남)',
    buff: buffOf('성령의 메이스', 20),
    skillStyle: null
  }

  assert.equal(buffSwitchingOf(source), null)
})

test('버프 강화 스킬 레벨이 없거나 딜러가 배운 레벨을 한 번에 찾지 못하면 바꿀 수 없다', () => {
  const noLevel = { ...dealer(20, 13), buff: { skillInfo: { skillId: SKILL_ID, name: '하악질' } } }
  const notLearned = { ...dealer(20, 13), skillStyle: skillStyleOf(13, 'other-skill') }
  const twice = {
    ...dealer(20, 13),
    skillStyle: {
      style: { active: skillStyleOf(13).style.active, passive: skillStyleOf(13).style.active }
    }
  }

  assert.equal(buffSwitchingOf(noLevel), null)
  assert.equal(buffSwitchingOf({ ...dealer(20, 13), buff: null }), null)
  assert.equal(buffSwitchingOf(notLearned), null)
  assert.equal(buffSwitchingOf(twice), null)
})

test('딜러는 칭호를 뺀 버프 강화 장비 가운데 짙편린 이름의 장비 수를 지금 등록한 수로 본다', () => {
  const source = dealer(20, 13)
  const buff = {
    ...source.buff,
    equipment: [
      { slotId: 'WEAPON', itemName: '짙은 심연의 편린 소검 : 하악질' },
      { slotId: 'RING', itemName: '짙은 심연의 편린 반지 : 하악질' },
      { slotId: 'EARRING', itemName: '짙은 뒤틀린 심연의 귀걸이 : 하악질' },
      { slotId: 'JACKET', itemName: '심연의 편린 상의 : 하악질' },
      { slotId: 'SUPPORT', itemName: '침식된 심연의 완장 : 하악질' },
      { slotId: 'TITLE', itemName: '짙은 심연의 편린 칭호' }
    ]
  }

  assert.deepEqual(buffSwitchingOf({ ...source, buff }).equipment, { count: 3, max: 12 })
})

test('딜러는 짙편린 등록 수를 0~12에서 고를 수 있고 버퍼는 고를 수 없다', () => {
  const switching = buffSwitchingOf(dealer(20, 13))
  const buffer = buffSwitchingOf({
    role: 'buffer',
    jobName: '프리스트(여)',
    buff: buffOf('용맹의 축복', 30),
    skillStyle: null
  })

  assert.equal(isSelectableSwitchingEquipment(switching, 0), true)
  assert.equal(isSelectableSwitchingEquipment(switching, 12), true)
  assert.equal(isSelectableSwitchingEquipment(switching, -1), false)
  assert.equal(isSelectableSwitchingEquipment(switching, 13), false)
  assert.equal(isSelectableSwitchingEquipment(switching, 1.5), false)
  assert.equal(isSelectableSwitchingEquipment(buffer, 0), false)
})
