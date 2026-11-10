import assert from 'node:assert/strict'
import test from 'node:test'
import type { StoredCharacter } from '@dfragon/database'
import { toCharacterRow } from '../src/domain/character-row.js'
import { MaleCrusader } from '../src/domain/male-crusader.js'

test('남성 크루세이더는 active나 passive에 용기의 은총이 있을 때만 딜러, 아니면 버퍼다', () => {
  for (const [skillStyle, role] of [
    [{ style: { active: [{ name: '용기의 은총' }], passive: [] } }, 'dealer'],
    [{ style: { active: [], passive: [{ name: '용기의 은총' }] } }, 'dealer'],
    [
      { style: { active: [{ name: '용기의 은총 강화' }], passive: [{ name: '기본기 숙련' }] } },
      'buffer'
    ],
    [{ style: { active: null, passive: ['용기의 은총'] } }, 'buffer'],
    [{ style: null }, 'buffer'],
    [null, 'buffer']
  ] as const) {
    assert.equal(MaleCrusader.fromSkillStyle(skillStyle).role(), role, JSON.stringify(skillStyle))
  }
})

// 합성 캐릭터 행이다.
function stored(
  jobName: string | null,
  jobGrowName: string | null,
  dealerSkillLearned: boolean | null
): StoredCharacter {
  return {
    serverId: 'cain',
    characterId: 'synthetic-row',
    characterName: '합성캐릭터',
    adventureName: '합성모험단',
    level: 115,
    jobId: null,
    jobGrowId: null,
    jobName,
    jobGrowName,
    fame: 100000,
    guildId: null,
    guildName: null,
    fetchedAt: null,
    dealerSkillLearned
  }
}

test('캐릭터 행의 role은 남성 크루세이더만 저장된 용기의 은총 여부로, 그 밖은 전직 이름으로 정한다', () => {
  for (const [name, character, role] of [
    ['남성 크루세이더 딜러', stored('프리스트(남)', '眞 크루세이더', true), 'dealer'],
    ['남성 크루세이더 버퍼', stored('프리스트(남)', '眞 크루세이더', false), 'buffer'],
    ['스킬 스타일 행 없는 남성 크루세이더', stored('프리스트(남)', '眞 크루세이더', null), null],
    ['여성 크루세이더', stored('프리스트(여)', '眞 크루세이더', true), 'buffer'],
    ['버퍼 전직', stored('마법사(여)', '眞 인챈트리스', null), 'buffer'],
    ['딜러 전직', stored('귀검사(남)', '眞 웨펀마스터', false), 'dealer'],
    ['직업 모름', stored(null, null, null), null]
  ] as const) {
    const row = toCharacterRow(character)

    assert.equal(row.role, role, name)
    assert.equal('dealerSkillLearned' in row, false, name)
  }
})
