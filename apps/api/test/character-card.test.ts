import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { projectCharacterCard } from '../src/characters/card/project.js'
import { cardScoreCalculator } from '../src/characters/card/score.js'
import type { CharacterCard } from '../src/characters/card/types.js'
import { projectCharacterDetails } from '../src/characters/details/project.js'
import type { CharacterDetailSection } from '../src/characters/details/sections.js'

// 이전 Desktop은 카드 전체를 엄격하게 검사하므로 지운 칸은 빈 값으로 남긴다.
const retiredFields = {
  stats: null,
  score: null,
  serverRank: null,
  set: null,
  oath: null,
  investment: []
} as const

function readFixture(role: 'dealer' | 'buffer') {
  const url = new URL(`../../test/fixtures/character-card-${role}.json`, import.meta.url)

  return JSON.parse(readFileSync(url, 'utf8')) as {
    sections: Record<CharacterDetailSection, Record<string, unknown>>
    card: CharacterCard
  }
}

test('실응답 fixture의 딜러와 버퍼는 역할만 정하고 지운 칸은 빈 값으로 둔다', () => {
  for (const role of ['dealer', 'buffer'] as const) {
    const fixture = readFixture(role)
    const { serverId, characterId } = fixture.sections.basic as Record<string, string>
    const identity = { serverId: serverId!, characterId: characterId! }
    const at = new Date('2026-10-19T00:00:00.000Z')

    const card = projectCharacterCard(projectCharacterDetails(identity, fixture.sections, at))

    assert.deepEqual(card, { role, ...retiredFields }, role)
  }
})

test('역할은 眞 접두를 포함한 버퍼 전직명으로 정하고 직업을 모르면 null이다', () => {
  for (const [jobGrowName, role] of [
    ['眞 크루세이더', 'buffer'],
    ['眞 인챈트리스', 'buffer'],
    ['眞 패러메딕', 'buffer'],
    ['眞 뮤즈', 'buffer'],
    ['뮤즈', 'buffer'],
    ['眞 이단심판관', 'dealer'],
    ['眞 뮤즈 아님', 'dealer'],
    [null, null],
    ['', null],
    [42, null],
    [undefined, null]
  ] as const) {
    const card = projectCharacterCard({ character: { jobGrowName }, skillStyle: null })
    assert.deepEqual(card, { role, ...retiredFields }, String(jobGrowName))
  }
})

function skillStyleWith(passiveNames: string[], activeNames: string[] = []) {
  const skills = (names: string[]) => names.map((name) => ({ name, level: 1 }))

  return { style: { active: skills(activeNames), passive: skills(passiveNames) } }
}

test('남성 크루세이더는 용기의 은총을 습득하면 딜러, 아니면 버퍼다', () => {
  for (const [jobName, skillStyle, role] of [
    ['프리스트(남)', skillStyleWith(['용기의 은총']), 'dealer'],
    ['프리스트(남)', skillStyleWith([], ['용기의 은총']), 'dealer'],
    ['프리스트(남)', skillStyleWith(['기본기 숙련']), 'buffer'],
    ['프리스트(남)', null, 'buffer'],
    ['프리스트(여)', skillStyleWith(['용기의 은총']), 'buffer'],
    [null, skillStyleWith(['용기의 은총']), 'buffer']
  ] as const) {
    for (const jobGrowName of ['眞 크루세이더', '크루세이더']) {
      const card = projectCharacterCard({ character: { jobName, jobGrowName }, skillStyle })
      assert.deepEqual(card, { role, ...retiredFields }, `${jobName} ${jobGrowName} ${role}`)
    }
  }
})

test('버퍼만 버프 점수로, 딜러, 시너지, 역할을 모르는 카드는 장비 점수로 계산한다', () => {
  for (const [role, calculator] of [
    ['buffer', 'buff'],
    ['dealer', 'equipment'],
    ['synergy', 'equipment'],
    [null, 'equipment']
  ] as const) {
    assert.equal(cardScoreCalculator(role), calculator, String(role))
  }
})
