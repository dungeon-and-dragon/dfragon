import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { CharacterPayloads } from '../src/domain/character-detail/sections.js'
import {
  restoreCharacterHeader,
  toSectionBodies
} from '../src/domain/character-history/section-body.js'

function readSections(role: 'dealer' | 'buffer'): CharacterPayloads {
  const url = new URL(`../../test/fixtures/character-card-${role}.json`, import.meta.url)

  return (JSON.parse(readFileSync(url, 'utf8')) as { sections: CharacterPayloads }).sections
}

const headerKeys = [
  'serverId',
  'characterId',
  'characterName',
  'level',
  'jobId',
  'jobGrowId',
  'jobName',
  'jobGrowName',
  'fame',
  'adventureName',
  'guildId',
  'guildName'
]

test('실응답 fixture의 섹션 10개에서 캐릭터 헤더를 빼고, 기본 정보를 다시 붙이면 받은 섹션과 같다', () => {
  for (const role of ['dealer', 'buffer'] as const) {
    const sections = readSections(role)
    const bodies = toSectionBodies(sections)

    assert.deepEqual(Object.keys(bodies).toSorted(), [
      'avatar',
      'buff_avatar',
      'buff_creature',
      'buff_equipment',
      'creature',
      'equipment',
      'mist_assimilation',
      'oath',
      'skill_style',
      'status'
    ])

    for (const [section, body] of Object.entries(bodies)) {
      assert.deepEqual(
        Object.keys(body).filter((key) => headerKeys.includes(key)),
        [],
        `${role} ${section}`
      )

      const restored = restoreCharacterHeader(sections.basic, body)
      assert.deepEqual(restored, sections[section as keyof CharacterPayloads], `${role} ${section}`)
    }
  }
})

test('기본 정보만 바뀐 응답은 섹션 본문이 같다', () => {
  const sections = readSections('dealer')
  const changedHeader = { fame: 1, characterName: '다른이름' }
  const renamed: CharacterPayloads = { ...sections }

  for (const section of Object.keys(sections) as (keyof CharacterPayloads)[]) {
    renamed[section] = { ...sections[section], ...changedHeader }
  }

  assert.notDeepEqual(renamed.equipment, sections.equipment)
  assert.deepEqual(toSectionBodies(renamed), toSectionBodies(sections))
})
