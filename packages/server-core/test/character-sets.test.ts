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
const effect = [{ name: '최종 데미지 증가', value: '100%' }]
const unworn = { avatar: { ...header, avatar: [] }, creature: { ...header, creature: null } }

test('실응답 fixture에서 장비 세트는 등급별 이름이 아닌 부위의 고정 이름으로, 효과가 켜진 서약은 세트와 고른 선택지로 뽑는다', () => {
  assert.deepEqual(parseCharacterSets(readSections('dealer')), {
    equipmentSet: { id: '4ee7bd5912cda6e2a24c1f36d5202b46', name: '소울 페어리 세트' },
    oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' },
    items: [
      {
        slotId: 'WEAPON',
        itemId: '89c42c1d02e6749244ce518e9b34e1c7',
        itemName: '재앙의 송곳니',
        typeDetail: '낫'
      },
      {
        slotId: 'TITLE',
        itemId: '6f008c0c92c0346b114d2ffdafb92292',
        itemName: '프로스트의 전설 플래티넘[35Lv]',
        typeDetail: '칭호'
      },
      {
        slotId: 'AURORA',
        itemId: '25e7652de779ccea0d8559a3e5bf7e01',
        itemName: '고결한 영혼의 잔상',
        typeDetail: null
      },
      {
        slotId: 'CREATURE',
        itemId: 'bf04e5b415fea3989e8607efb4987d14',
        itemName: '운명을 담는 재단사',
        typeDetail: null
      }
    ]
  })
  // 버퍼 fixture의 서약은 레어 Ⅱ(905점) 구간 안이지만 효과가 붙는 등급에 못 미쳐, active에 setPoint만 오고 status가 없다.
  assert.deepEqual(parseCharacterSets(readSections('buffer')), {
    equipmentSet: { id: '93e7825053bdec4e0f4c12837cf4f57e', name: '에테리얼 오브 아츠 세트' },
    oathSet: null,
    items: [
      {
        slotId: 'WEAPON',
        itemId: '4c2c36b92f60155c579d36eea9786324',
        itemName: '시크릿 듀엣',
        typeDetail: '선현궁'
      },
      {
        slotId: 'TITLE',
        itemId: '74711128d2d0739c4f5d38b488d2be2c',
        itemName: '[EVENT]세리아의 풍성한 선물 Ver.2',
        typeDetail: '칭호'
      },
      {
        slotId: 'AURORA',
        itemId: 'e3a8f465174ad184ee15dafb221634d2',
        itemName: '[EVENT]세리아의 파스텔 버블 Ver.2',
        typeDetail: null
      },
      {
        slotId: 'CREATURE',
        itemId: 'ece0c0fe0f7164f43337f0abd172471b',
        itemName: 'SD 히만 스텔라',
        typeDetail: null
      }
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
        {
          setItemId: 'set-a',
          setItemName: '등급 A 세트',
          active: { setPoint: { current: 900 }, status: effect }
        },
        {
          setItemId: 'set-b',
          setItemName: '등급 B 세트',
          active: { setPoint: { current: 1650 }, status: effect }
        }
      ]
    },
    oath: { ...header, oath: null },
    ...unworn
  })

  assert.deepEqual(sets?.equipmentSet, { id: 'set-b', name: '합성 B 세트' })
})

test('setItemInfo가 빈 배열이면 장비 세트가, oath.setInfo가 없으면 서약 세트가 null이다', () => {
  const noOath = parseCharacterSets({
    equipment: { ...header, equipment: [], setItemInfo: [] },
    oath: { ...header, oath: null },
    ...unworn
  })
  const noSetInfo = parseCharacterSets({
    equipment: { ...header, equipment: null, setItemInfo: null },
    oath: { ...header, oath: { info: null, crystal: [] } },
    ...unworn
  })

  assert.deepEqual(noOath, { equipmentSet: null, oathSet: null, items: [] })
  assert.deepEqual(noSetInfo, { equipmentSet: null, oathSet: null, items: [] })
})

test('세트 항목의 모양이 다르면 세트 값을 뽑지 않는다', () => {
  const sets = parseCharacterSets({
    equipment: { ...header, equipment: [], setItemInfo: [{ setItemId: 'set-a' }] },
    oath: { ...header, oath: null },
    ...unworn
  })

  assert.equal(sets, undefined)
})

test('가명 처리한 실응답의 장비에서 무기, 칭호와 exaltedInfo가 있는 유일 장비 부위만 뽑는다', () => {
  const payloads = payloadsFromEngineInput(readEngineInput('buffer-muse'))
  const equipmentItems = parseCharacterSets(payloads)?.items.filter(
    ({ slotId }) => slotId !== 'AURORA' && slotId !== 'CREATURE'
  )

  assert.deepEqual(equipmentItems, [
    {
      slotId: 'WEAPON',
      itemId: '8a79cefa4aec25884139327f093ef696',
      itemName: '검은 질병의 시크릿 콘서트',
      typeDetail: '선현궁'
    },
    {
      slotId: 'TITLE',
      itemId: '8926f2ed6cd9e9c7929d738e333abac1',
      itemName: '찢어지는 독기',
      typeDetail: '칭호'
    },
    {
      slotId: 'SUPPORT',
      itemId: '6e1fcf6e59ed8d5a95dc152b84fe93ce',
      itemName: '만병을 잉태한 역병의 심장',
      typeDetail: '보조장비'
    }
  ])
})

test('유일 장비가 어느 부위에 있든 뽑고, 칭호도 뽑으며, 세트 부위와 exaltedInfo가 null인 부위는 뽑지 않는다', () => {
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
    oath: { ...header, oath: null },
    ...unworn
  })

  assert.deepEqual(
    sets?.items.map(({ slotId }) => slotId),
    ['WEAPON', 'TITLE', 'RING', 'SUPPORT', 'MAGIC_STON', 'EARRING']
  )
})

test('효과가 켜지지 않은 장비 세트는 고르지 않고, 켜진 세트 가운데 포인트가 가장 큰 세트를 고른다', () => {
  const equipmentWith = (setItemInfo: unknown[]) => ({
    ...header,
    equipment: [
      { setItemId: 'set-a', setItemName: '합성 A 세트' },
      { setItemId: 'set-b', setItemName: '합성 B 세트' }
    ],
    setItemInfo
  })

  const oath = { ...header, oath: null }

  const effective = {
    setItemId: 'set-a',
    setItemName: '등급 A 세트',
    active: { setPoint: { current: 900 }, status: effect }
  }

  const pointsOnly = {
    setItemId: 'set-b',
    setItemName: '등급 B 세트',
    active: { setPoint: { current: 1650, min: 1540, max: 1650 } }
  }

  const mixed = parseCharacterSets({
    equipment: equipmentWith([pointsOnly, effective]),
    oath,
    ...unworn
  })
  const onlyOff = parseCharacterSets({ equipment: equipmentWith([pointsOnly]), oath, ...unworn })
  const noActive = parseCharacterSets({
    equipment: equipmentWith([{ setItemId: 'set-b', setItemName: '등급 B 세트', active: null }]),
    oath,
    ...unworn
  })

  assert.deepEqual(mixed?.equipmentSet, { id: 'set-a', name: '합성 A 세트' })
  assert.equal(onlyOff?.equipmentSet, null)
  assert.equal(noActive?.equipmentSet, null)
})

test('효과가 켜지지 않은 서약 세트는 세트와 선택지를 모두 null로 두고, 아이템 줄은 그대로다', () => {
  const sections = readSections('dealer')
  const oath = sections.oath as { oath: { setInfo: { active: Record<string, unknown> } } }
  const {
    status: _status,
    explain: _explain,
    explainDetail: _detail,
    ...pointsOnly
  } = oath.oath.setInfo.active

  const inactive = {
    ...sections,
    oath: { ...oath, oath: { ...oath.oath, setInfo: { ...oath.oath.setInfo, active: pointsOnly } } }
  }

  const sets = parseCharacterSets(inactive)

  assert.equal(sets?.oathSet, null)
  assert.deepEqual(sets?.equipmentSet, {
    id: '4ee7bd5912cda6e2a24c1f36d5202b46',
    name: '소울 페어리 세트'
  })
  assert.deepEqual(sets?.items, parseCharacterSets(sections)?.items)
})

test('빈 itemTypeDetail은 종류를 모르는 것으로 null로 뽑는다', () => {
  const sets = parseCharacterSets({
    equipment: {
      ...header,
      equipment: [
        { slotId: 'WEAPON', itemId: 'weapon', itemName: '합성 무기', itemTypeDetail: '' }
      ],
      setItemInfo: []
    },
    oath: { ...header, oath: null },
    ...unworn
  })

  assert.deepEqual(sets?.items, [
    { slotId: 'WEAPON', itemId: 'weapon', itemName: '합성 무기', typeDetail: null }
  ])
})

test('아바타에서는 오라 부위만, 크리쳐는 CREATURE 부위로 뽑고 다른 아바타 부위는 뽑지 않는다', () => {
  const sets = parseCharacterSets({
    equipment: { ...header, equipment: [], setItemInfo: [] },
    oath: { ...header, oath: null },
    avatar: {
      ...header,
      avatar: [
        { slotId: 'HEADGEAR', itemId: 'headgear', itemName: '합성 모자 아바타' },
        { slotId: 'AURORA', itemId: 'aura', itemName: '합성 오라' },
        { slotId: 'WEAPON', itemId: 'weapon-avatar', itemName: '합성 무기 아바타' }
      ]
    },
    creature: { ...header, creature: { itemId: 'creature', itemName: '합성 크리쳐[30Lv]' } }
  })

  assert.deepEqual(sets?.items, [
    { slotId: 'AURORA', itemId: 'aura', itemName: '합성 오라', typeDetail: null },
    { slotId: 'CREATURE', itemId: 'creature', itemName: '합성 크리쳐[30Lv]', typeDetail: null }
  ])
})

test('크리쳐가 없거나 아이템 id, 이름이 빈 크리쳐와 오라는 뽑지 않는다', () => {
  const base = {
    equipment: { ...header, equipment: [], setItemInfo: [] },
    oath: { ...header, oath: null }
  }
  const emptyCreature = parseCharacterSets({
    ...base,
    avatar: { ...header, avatar: [{ slotId: 'AURORA', itemId: null, itemName: '합성 오라' }] },
    creature: { ...header, creature: { itemId: null, itemName: null } }
  })
  const noSections = parseCharacterSets({
    ...base,
    avatar: { ...header, avatar: null },
    creature: { ...header }
  })

  assert.deepEqual(emptyCreature?.items, [])
  assert.deepEqual(noSections?.items, [])
})

test('아바타나 크리쳐 응답의 모양이 다르면 세트 값을 뽑지 않는다', () => {
  const base = {
    equipment: { ...header, equipment: [], setItemInfo: [] },
    oath: { ...header, oath: null }
  }

  assert.equal(
    parseCharacterSets({ ...base, ...unworn, avatar: { ...header, avatar: 'aura' } }),
    undefined
  )
  assert.equal(
    parseCharacterSets({ ...base, ...unworn, creature: { ...header, creature: [] } }),
    undefined
  )
})
