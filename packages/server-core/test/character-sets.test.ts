import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { CharacterPayloads } from '../src/domain/character-detail/sections.js'
import { parseCharacterSets } from '../src/infrastructure/neople/character-sets.js'
import { payloadsFromEngineInput, readEngineInput } from './score-fixtures.js'

function readSections(role: 'dealer' | 'buffer'): CharacterPayloads {
  const url = new URL(`../../test/fixtures/character-card-${role}.json`, import.meta.url)

  return (JSON.parse(readFileSync(url, 'utf8')) as { sections: CharacterPayloads }).sections
}

const header = { serverId: 'cain', characterId: 'synthetic', characterName: '합성캐릭터' }

test('실응답 fixture에서 장비 세트는 등급별 이름이 아닌 부위의 고정 이름으로, 서약은 세트와 고른 선택지로 뽑는다', () => {
  assert.deepEqual(parseCharacterSets(readSections('dealer')), {
    equipmentSet: { id: '4ee7bd5912cda6e2a24c1f36d5202b46', name: '소울 페어리 세트' },
    oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' },
    items: [
      { slotId: 'WEAPON', itemId: '89c42c1d02e6749244ce518e9b34e1c7', itemName: '재앙의 송곳니' }
    ]
  })
  assert.deepEqual(parseCharacterSets(readSections('buffer')), {
    equipmentSet: { id: '93e7825053bdec4e0f4c12837cf4f57e', name: '에테리얼 오브 아츠 세트' },
    oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' },
    items: [
      { slotId: 'WEAPON', itemId: '4c2c36b92f60155c579d36eea9786324', itemName: '시크릿 듀엣' }
    ]
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

  assert.deepEqual(noOath, { equipmentSet: null, oathSet: null, items: [] })
  assert.deepEqual(noSetInfo, { equipmentSet: null, oathSet: null, items: [] })
})

test('세트 항목의 모양이 다르면 세트 값을 뽑지 않는다', () => {
  const sets = parseCharacterSets({
    equipment: { ...header, equipment: [], setItemInfo: [{ setItemId: 'set-a' }] },
    oath: { ...header, oath: null }
  })

  assert.equal(sets, undefined)
})

test('가명 처리한 실응답에서 무기와 exaltedInfo가 있는 유일 장비 부위만 뽑는다', () => {
  const payloads = payloadsFromEngineInput(readEngineInput('buffer-muse'))

  assert.deepEqual(parseCharacterSets(payloads)?.items, [
    {
      slotId: 'WEAPON',
      itemId: '8a79cefa4aec25884139327f093ef696',
      itemName: '검은 질병의 시크릿 콘서트'
    },
    {
      slotId: 'SUPPORT',
      itemId: '6e1fcf6e59ed8d5a95dc152b84fe93ce',
      itemName: '만병을 잉태한 역병의 심장'
    }
  ])
})

test('유일 장비가 어느 부위에 있든 뽑고, 세트 부위와 칭호, exaltedInfo가 null인 부위는 뽑지 않는다', () => {
  const exalted = { damage: '50.2%' }
  const sets = parseCharacterSets({
    equipment: {
      ...header,
      equipment: [
        { slotId: 'WEAPON', itemId: 'weapon', itemName: '합성 무기' },
        { slotId: 'TITLE', itemId: 'title', itemName: '합성 칭호' },
        { slotId: 'JACKET', itemId: 'jacket', itemName: '합성 상의', setItemId: 'set-a' },
        { slotId: 'RING', itemId: 'ring', itemName: '합성 반지', exaltedInfo: exalted },
        { slotId: 'SUPPORT', itemId: 'support', itemName: '합성 보조', exaltedInfo: exalted },
        { slotId: 'MAGIC_STON', itemId: 'stone', itemName: '합성 마법석', exaltedInfo: exalted },
        { slotId: 'EARRING', itemId: 'earring', itemName: '합성 귀걸이', exaltedInfo: exalted },
        { slotId: 'SHOES', itemId: 'shoes', itemName: '합성 신발', exaltedInfo: null }
      ],
      setItemInfo: []
    },
    oath: { ...header, oath: null }
  })

  assert.deepEqual(
    sets?.items.map(({ slotId }) => slotId),
    ['WEAPON', 'RING', 'SUPPORT', 'MAGIC_STON', 'EARRING']
  )
})
