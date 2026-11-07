import assert from 'node:assert/strict'
import test from 'node:test'
import { characterSkillStyleSchema } from '@dfragon/neople'

// 합성 캐릭터의 /skill/style 응답이다. 실제 응답처럼 최상위에 기본 정보가 함께 온다.
function skillStyleBody(style) {
  return {
    serverId: 'cain',
    characterId: 'synthetic-skill',
    characterName: '합성스킬',
    level: 115,
    jobId: 'synthetic-job',
    jobGrowId: 'synthetic-grow',
    jobName: '프리스트(여)',
    jobGrowName: '眞 이단심판관',
    fame: 70000,
    skill: { hash: 'synthetic-hash', style }
  }
}

test('active와 passive를 합쳐 이름과 레벨만 남기고 개화, 강화는 배운 스킬 이름으로 바꾼다', () => {
  const parsed = characterSkillStyleSchema.parse(
    skillStyleBody({
      active: [
        { skillId: 'active-a', name: '홀리 스매쉬', level: 13, requiredLevel: 1 },
        { skillId: 'active-b', name: '참회의 망치', level: 1, requiredLevel: 100 }
      ],
      passive: [{ skillId: 'passive-a', name: '기본기 숙련', level: 115, requiredLevel: 1 }],
      evolution: [
        { skillId: 'active-b', type: 2 },
        { skillId: 'active-a', type: 1 }
      ],
      enhancement: [{ skillId: 'active-a', type: 1 }],
      chain: { resetTime: 0, skills: ['active-a'] }
    })
  )

  assert.deepEqual(parsed, {
    jobId: 'synthetic-job',
    jobGrowId: 'synthetic-grow',
    skills: [
      { name: '홀리 스매쉬', level: 13 },
      { name: '참회의 망치', level: 1 },
      { name: '기본기 숙련', level: 115 }
    ],
    evolutions: [
      { name: '참회의 망치', type: 2 },
      { name: '홀리 스매쉬', type: 1 }
    ],
    enhancements: [{ name: '홀리 스매쉬', type: 1 }]
  })
})

test('배운 목록에 없는 스킬의 개화, 강화는 빼고 나머지는 남긴다', () => {
  const parsed = characterSkillStyleSchema.parse(
    skillStyleBody({
      active: [{ skillId: 'active-a', name: '홀리 스매쉬', level: 13, requiredLevel: 1 }],
      passive: [],
      evolution: [
        { skillId: 'unknown', type: 1 },
        { skillId: 'active-a', type: 2 }
      ],
      enhancement: [{ skillId: 'unknown', type: 2 }]
    })
  )

  assert.deepEqual(parsed.evolutions, [{ name: '홀리 스매쉬', type: 2 }])
  assert.deepEqual(parsed.enhancements, [])
})

test('passive, 개화, 강화가 없거나 null이면 빈 목록으로 본다', () => {
  const parsed = characterSkillStyleSchema.parse(
    skillStyleBody({
      active: [{ skillId: 'active-a', name: '홀리 스매쉬', level: 13, requiredLevel: 1 }],
      passive: null,
      evolution: null
    })
  )

  assert.deepEqual(parsed.skills, [{ name: '홀리 스매쉬', level: 13 }])
  assert.deepEqual(parsed.evolutions, [])
  assert.deepEqual(parsed.enhancements, [])
})

for (const [name, body] of [
  ['스킬 스타일이 없는 응답', skillStyleBody(null)],
  ['active가 없는 응답', skillStyleBody({ passive: [] })],
  [
    '레벨이 정수가 아닌 스킬',
    skillStyleBody({ active: [{ skillId: 'active-a', name: '홀리 스매쉬', level: '13' }] })
  ],
  [
    '전직이 없는 응답',
    {
      ...skillStyleBody({ active: [] }),
      jobGrowId: undefined
    }
  ]
]) {
  test(`${name}은 받지 않는다`, () => {
    assert.equal(characterSkillStyleSchema.safeParse(body).success, false)
  })
}
