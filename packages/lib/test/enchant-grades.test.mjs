import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chooseEnchantGrade,
  groupEnchantEntries,
  optionNeedsMainStat
} from '@dfragon/lib/enchant-grades'

function gradeOf(id, status) {
  return { id, status, reinforceSkill: [] }
}

const STRENGTH_GRADE = gradeOf('strength', [{ name: '힘', value: 100 }])
const INTELLIGENCE_GRADE = gradeOf('intelligence', [{ name: '지능', value: 100 }])
const mainStatOption = { members: [STRENGTH_GRADE, INTELLIGENCE_GRADE] }

const FOUR_STATS_GRADE = gradeOf('four-stats', [
  { name: '힘', value: 100 },
  { name: '지능', value: 100 },
  { name: '체력', value: 100 },
  { name: '정신력', value: 100 }
])
const fourStatsOption = { members: [STRENGTH_GRADE, FOUR_STATS_GRADE] }
const singleOption = { members: [STRENGTH_GRADE] }

test('optionNeedsMainStat은 멤버가 둘 이상이고 4스탯 멤버가 없을 때만 true다', () => {
  assert.equal(optionNeedsMainStat(mainStatOption), true)
  assert.equal(optionNeedsMainStat(fourStatsOption), false)
  assert.equal(optionNeedsMainStat(singleOption), false)
})

test('chooseEnchantGrade는 4스탯 멤버가 있으면 주스탯과 상관없이 그 멤버를, 멤버가 하나면 그 멤버를 고른다', () => {
  assert.equal(chooseEnchantGrade(fourStatsOption, '체력'), FOUR_STATS_GRADE)
  assert.equal(chooseEnchantGrade(singleOption, null), STRENGTH_GRADE)
})

test('chooseEnchantGrade는 주스탯을 가진 멤버를 고르고 없으면 첫 멤버를 고른다', () => {
  assert.equal(chooseEnchantGrade(mainStatOption, '지능'), INTELLIGENCE_GRADE)
  assert.equal(chooseEnchantGrade(mainStatOption, '체력'), STRENGTH_GRADE)
})

function entryOf(name, status, reinforceSkill = []) {
  return { name, status, reinforceSkill }
}

const BUFF_SKILL_3 = [{ jobName: '아처', skills: [{ name: '센세이션', value: '3' }] }]
const BUFF_SKILL_4 = [{ jobName: '아처', skills: [{ name: '센세이션', value: '4' }] }]

test('groupEnchantEntries는 칸 순서와 % 표기가 달라도 표시가 같으면 받은 순서대로 한 묶음으로 두고, 직업별 스킬 강화가 다르면 나눈다', () => {
  const groups = groupEnchantEntries([
    entryOf('a', [
      { name: '최종 데미지 증가', value: '3%' },
      { name: '힘', value: 90 }
    ]),
    entryOf('b', [
      { name: '힘', value: 90 },
      { name: '지능', value: 90 },
      { name: '최종 데미지 증가', value: '3.0%' }
    ]),
    entryOf('c', [{ name: '힘', value: 100 }], BUFF_SKILL_3),
    entryOf('d', [{ name: '힘', value: 100 }], BUFF_SKILL_4),
    entryOf('e', [{ name: '지능', value: 100 }], BUFF_SKILL_3)
  ])

  assert.deepEqual(
    groups.map(({ members }) => members.map(({ name }) => name)),
    [['a', 'b'], ['c', 'e'], ['d']]
  )
  assert.deepEqual(groups[0].display, [
    { name: '최종 데미지 증가', value: '3%' },
    { name: '올스탯', value: 90 }
  ])
  assert.notEqual(groups[1].key, groups[2].key)
})
