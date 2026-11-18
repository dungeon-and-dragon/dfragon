import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { CharacterPayloads } from '../src/domain/character-detail/sections.js'
import { parseCharacterSets } from '../src/infrastructure/neople/character-sets.js'

function readSections(role: 'dealer' | 'buffer'): CharacterPayloads {
  const url = new URL(`../../test/fixtures/character-card-${role}.json`, import.meta.url)

  return (JSON.parse(readFileSync(url, 'utf8')) as { sections: CharacterPayloads }).sections
}

const header = { serverId: 'cain', characterId: 'synthetic', characterName: '합성캐릭터' }

test('실응답 fixture에서 장비 세트는 등급별 이름이 아닌 부위의 고정 이름으로, 서약은 세트와 고른 선택지로 뽑는다', () => {
  assert.deepEqual(parseCharacterSets(readSections('dealer')), {
    equipmentSet: { id: '4ee7bd5912cda6e2a24c1f36d5202b46', name: '소울 페어리 세트' },
    oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' }
  })
  assert.deepEqual(parseCharacterSets(readSections('buffer')), {
    equipmentSet: { id: '93e7825053bdec4e0f4c12837cf4f57e', name: '에테리얼 오브 아츠 세트' },
    oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' }
  })
})

test('setItemInfo에 세트가 여럿이면 현재 세트 포인트가 가장 큰 세트를 고른다', () => {
  const sets = parseCharacterSets({
    equipment: {
      ...header,
      equipment: [
        { setItemId: 'set-a', setItemName: '합성 A 세트' },
        { setItemId: 'set-b', setItemName: '합성 B 세트' }
      ],
      setItemInfo: [
        { setItemId: 'set-a', setItemName: '등급 A 세트', active: { setPoint: { current: 900 } } },
        { setItemId: 'set-b', setItemName: '등급 B 세트', active: { setPoint: { current: 1650 } } }
      ]
    },
    oath: { ...header, oath: null }
  })

  assert.deepEqual(sets?.equipmentSet, { id: 'set-b', name: '합성 B 세트' })
})

test('setItemInfo가 빈 배열이면 장비 세트가, oath.setInfo가 없으면 서약 세트가 null이다', () => {
  const noOath = parseCharacterSets({
    equipment: { ...header, equipment: [], setItemInfo: [] },
    oath: { ...header, oath: null }
  })
  const noSetInfo = parseCharacterSets({
    equipment: { ...header, equipment: null, setItemInfo: null },
    oath: { ...header, oath: { info: null, crystal: [] } }
  })

  assert.deepEqual(noOath, { equipmentSet: null, oathSet: null })
  assert.deepEqual(noSetInfo, { equipmentSet: null, oathSet: null })
})

test('세트 항목의 모양이 다르면 세트 값을 뽑지 않는다', () => {
  const sets = parseCharacterSets({
    equipment: { ...header, equipment: [], setItemInfo: [{ setItemId: 'set-a' }] },
    oath: { ...header, oath: null }
  })

  assert.equal(sets, undefined)
})
