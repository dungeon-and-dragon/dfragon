import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ENCHANT_GRADE_SLOTS, enchantGradesOf, findEnchantGrade } from '@dfragon/lib/enchant-grades'

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

// 표를 다시 생성해 값이 바뀌면 이 기대값도 함께 고친다.
for (const [slotId, role, expected] of [
  [
    'SHOULDER',
    'dealer',
    {
      종결: ['SHOULDER:10361761:dealer', 'SHOULDER:10401273:dealer'],
      준종결: ['SHOULDER:10325749:dealer']
    }
  ],
  ['WAIST', 'dealer', { 종결: ['WAIST:10361763:dealer'], 준종결: ['WAIST:10361762:dealer'] }],
  ['WAIST', 'buffer', { 종결: ['WAIST:10362002:buffer'], 준종결: [] }]
]) {
  test(`enchantGradesOf는 ${slotId} ${role}의 등급별 항목만 돌려준다`, () => {
    const grades = enchantGradesOf(slotId, role)

    assert.deepEqual({ 종결: idsOf(grades.종결), 준종결: idsOf(grades.준종결) }, expected)
  })
}

test('findEnchantGrade는 그 부위의 항목만 id로 찾고 다른 부위나 없는 id는 null이다', () => {
  const grade = findEnchantGrade('WAIST', 'WAIST:10361762:dealer')

  assert.equal(grade?.id, 'WAIST:10361762:dealer')
  assert.deepEqual(grade?.roles, ['dealer'])
  assert.equal(findEnchantGrade('WAIST', 'SHOULDER:10361761:dealer'), null)
  assert.equal(findEnchantGrade('WAIST', 'missing-enchant-grade'), null)
})
