import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ENCHANT_GRADE_SLOTS,
  chooseEnchantGrade,
  enchantOptionsOf,
  findEnchantOption,
  optionNeedsMainStat
} from '@dfragon/lib/enchant-grades'

const TIERS = ['종결', '준종결']
const ROLES = ['dealer', 'buffer']
// build가 등급표를 dist에 함께 실어야 package export로 읽힌다.
const table = JSON.parse(
  readFileSync(new URL('../dist/enchant-grades.json', import.meta.url), 'utf8')
)

function idsOf(grades) {
  return grades.map((grade) => grade.id)
}

test('등급표는 version 2이고 12부위마다 종결, 준종결 목록만 둔다', () => {
  assert.equal(table.version, 2)
  assert.deepEqual(Object.keys(table.slots).sort(), [...ENCHANT_GRADE_SLOTS].sort())
  for (const slotId of ENCHANT_GRADE_SLOTS) {
    assert.deepEqual(Object.keys(table.slots[slotId]).sort(), [...TIERS].sort(), slotId)
  }
})

test('등급표 항목은 부위 안에서 겹치지 않는 id, 마법부여 값, 한 역할을 가진다', () => {
  for (const slotId of ENCHANT_GRADE_SLOTS) {
    const grades = TIERS.flatMap((tier) => table.slots[slotId][tier])
    const ids = idsOf(grades)

    assert.equal(new Set(ids).size, ids.length, slotId)
    for (const grade of grades) {
      const name = `${slotId} ${grade.id}`
      assert.ok(grade.id.startsWith(`${slotId}:`), name)
      assert.ok(Array.isArray(grade.status), name)
      for (const status of grade.status) {
        assert.equal(typeof status.name, 'string', name)
        assert.ok(['number', 'string'].includes(typeof status.value), name)
      }
      assert.ok(Array.isArray(grade.reinforceSkill), name)
      for (const job of grade.reinforceSkill) {
        assert.equal(typeof job.jobName, 'string', name)
        assert.ok(Array.isArray(job.skills), name)
      }
      assert.equal(grade.roles.length, 1, name)
      assert.ok(ROLES.includes(grade.roles[0]), name)
    }
  }
})

function memberIdsOf(slotId, role) {
  const { 종결, 준종결 } = enchantOptionsOf(slotId, role)
  const finals = 종결.map(({ members }) => members.map(({ id }) => id))
  const semiFinals = 준종결.map(({ members }) => members.map(({ id }) => id))

  return { 종결: finals, 준종결: semiFinals }
}

// 표를 다시 생성해 묶임이 바뀌면 이 기대값도 함께 고친다.
for (const [name, slotId, role, expected] of [
  [
    '딜러 무기는 모든 속성 강화 +15 항목만 둔다',
    'WEAPON',
    'dealer',
    {
      종결: [['WEAPON:10337702:dealer']],
      준종결: [['WEAPON:10413546:dealer']]
    }
  ],
  [
    '버퍼 무기의 체력 100, 정신력 100, 4스탯 100은 하나로 묶인다',
    'WEAPON',
    'buffer',
    {
      종결: [['WEAPON:10342960:buffer']],
      준종결: [['WEAPON:10326802:buffer', 'WEAPON:10326833:buffer', 'WEAPON:10413548:buffer']]
    }
  ],
  [
    '딜러 상의의 공격력 110 카드 둘은 하나로 묶인다',
    'JACKET',
    'dealer',
    {
      종결: [['JACKET:10417944:dealer', 'JACKET:10418195:dealer']],
      준종결: [['JACKET:10361759:dealer']]
    }
  ],
  [
    '어깨 딜러는 버퍼 항목 없이 딜러 항목만 등급별로 둔다',
    'SHOULDER',
    'dealer',
    {
      종결: [['SHOULDER:10401273:dealer']],
      준종결: [['SHOULDER:10325749:dealer']]
    }
  ],
  [
    '허리 버퍼는 준종결 항목이 없으면 빈 목록이다',
    'WAIST',
    'buffer',
    { 종결: [['WAIST:10362002:buffer']], 준종결: [] }
  ],
  [
    '허리 딜러는 버퍼와 따로 딜러 카드의 명성으로 등급을 정한다',
    'WAIST',
    'dealer',
    { 종결: [['WAIST:10361762:dealer']], 준종결: [['WAIST:10336291:dealer']] }
  ]
]) {
  test(`enchantOptionsOf: ${name}`, () => {
    assert.deepEqual(memberIdsOf(slotId, role), expected)
  })
}

test('enchantOptionsOf는 묶음의 첫 항목 id를 option id로 두고 표시 스탯을 준다', () => {
  const [option] = enchantOptionsOf('JACKET', 'dealer').종결

  assert.equal(option.id, 'JACKET:10417944:dealer')
  assert.deepEqual(option.display, [
    { name: '공격력', value: 110 },
    { name: '올스탯', value: 90 },
    { name: '최종 데미지 증가', value: '3%' }
  ])
})

test('findEnchantOption은 멤버 어느 id로도 그 묶음을 찾고 다른 부위, 다른 역할이나 없는 id는 null이다', () => {
  const option = findEnchantOption('WEAPON', 'buffer', 'WEAPON:10326833:buffer')

  assert.equal(option?.id, 'WEAPON:10326802:buffer')
  assert.equal(findEnchantOption('WAIST', 'dealer', 'SHOULDER:10401273:dealer'), null)
  assert.equal(findEnchantOption('WEAPON', 'dealer', 'WEAPON:10326833:buffer'), null)
  assert.equal(findEnchantOption('WEAPON', 'buffer', 'missing-enchant-grade'), null)
})

// 지금 등급표에는 4스탯 멤버 없이 여러 멤버가 묶인 항목이 없어 표 모양대로 만든다.
function gradeOf(id, status) {
  return { id, status, reinforceSkill: [], fame: 196, cardName: id, cardId: 0, roles: ['dealer'] }
}

const STRENGTH_GRADE = gradeOf('strength', [{ name: '힘', value: 100 }])
const INTELLIGENCE_GRADE = gradeOf('intelligence', [{ name: '지능', value: 100 }])
const mainStatOption = {
  id: STRENGTH_GRADE.id,
  display: [{ name: '올스탯', value: 100 }],
  members: [STRENGTH_GRADE, INTELLIGENCE_GRADE]
}

test('optionNeedsMainStat은 멤버가 둘 이상이고 4스탯 멤버가 없을 때만 true다', () => {
  const bufferWeapon = findEnchantOption('WEAPON', 'buffer', 'WEAPON:10326802:buffer')
  const single = findEnchantOption('WAIST', 'dealer', 'WAIST:10361762:dealer')

  assert.equal(optionNeedsMainStat(mainStatOption), true)
  assert.equal(optionNeedsMainStat(bufferWeapon), false)
  assert.equal(optionNeedsMainStat(single), false)
})

for (const [name, slotId, role, id, mainStat, expected] of [
  [
    '4스탯 멤버가 있으면 주스탯과 상관없이 그 멤버',
    'WEAPON',
    'buffer',
    'WEAPON:10326802:buffer',
    '체력',
    'WEAPON:10413548:buffer'
  ],
  [
    '멤버가 하나면 그 멤버',
    'WAIST',
    'dealer',
    'WAIST:10361762:dealer',
    null,
    'WAIST:10361762:dealer'
  ]
]) {
  test(`chooseEnchantGrade: ${name}`, () => {
    const option = findEnchantOption(slotId, role, id)

    assert.equal(chooseEnchantGrade(option, mainStat).id, expected)
  })
}

test('chooseEnchantGrade는 주스탯을 가진 멤버를 고르고 없으면 첫 멤버를 고른다', () => {
  assert.equal(chooseEnchantGrade(mainStatOption, '지능'), INTELLIGENCE_GRADE)
  assert.equal(chooseEnchantGrade(mainStatOption, '체력'), STRENGTH_GRADE)
})
