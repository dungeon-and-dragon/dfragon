import { describe, expect, it } from 'vitest'
import { characterDetailFixture } from '../testing/character-detail'
import type { GameTextLines } from './game-text'
import { type OathCatalog, oathCatalogSchema, oathItemIconOf, oathSetBoardOf } from './oath-catalog'

type Effects = OathCatalog['sets'][number]['options'][number]['effects']

function rareEffect(rare: string | null): GameTextLines | null {
  if (rare === null) {
    return null
  }

  return [[{ text: rare, tone: 'rarity-rare' }]]
}

function effects(name: string, rare: string | null): Effects {
  return {
    rare: rareEffect(rare),
    unique: [[{ text: `${name} 유니크`, tone: 'rarity-unique' }]],
    legendary: [[{ text: `${name} 레전더리`, tone: 'rarity-legendary' }]],
    epic: [[{ text: `${name} 에픽`, tone: 'rarity-epic' }]],
    primitive: [
      [{ text: name, tone: 'rarity-primordial' }],
      [
        { text: '[강조]', tone: 'increase' },
        { text: ' 태초', tone: 'rarity-primordial' }
      ]
    ]
  }
}

// 데이터 묶음(oath.v2.json)과 같은 모양의 합성 데이터다. 세트 번호와 선택지 이름은 저장소 fixture의 용투 서약이다.
const CATALOG: OathCatalog = oathCatalogSchema.parse({
  version: 'synthetic',
  sets: [
    {
      setId: 16204,
      name: '야망의 용투 서약',
      icon: 'oath-set/16204.png',
      options: [
        {
          name: '용투 : 세계를 태우는 불꽃',
          icon: 'oath/9.png',
          effects: effects('불꽃', null)
        },
        { name: '용투 : 용의 분노', icon: 'oath/10.png', effects: effects('분노', '분노 레어') },
        { name: '용투 : 승리의 함성', icon: 'oath/11.png', effects: effects('함성', null) }
      ]
    }
  ],
  items: [
    { name: '영겁의 안개 서약', rarity: '레어', icon: 'oath-item/100610094.webp' },
    { name: '영겁의 안개 서약', rarity: '태초', icon: 'oath-item/100610096.webp' },
    { name: '영겁의 안개 서약', rarity: '알 수 없음', icon: 'oath-item/unknown.webp' }
  ]
})

function setInfoOf(role: 'dealer' | 'buffer') {
  const setInfo = characterDetailFixture(role).oath?.setInfo
  if (setInfo == null) {
    throw new Error(`${role} fixture에 서약 세트가 없다`)
  }

  return setInfo
}

describe('서약 세트 선택지', () => {
  it('setId로 세트를 찾고, setOptionName과 같은 선택지를 고른 것으로 두며 세트 등급의 문구를 쓴다', () => {
    const board = oathSetBoardOf(CATALOG, setInfoOf('dealer'))

    expect(board?.icon).toBe('oath-set/16204.png')
    expect(board?.options.map(({ icon, picked }) => [icon, picked])).toEqual([
      ['oath/9.png', true],
      ['oath/10.png', false],
      ['oath/11.png', false]
    ])
    expect(board?.options[0]?.effect).toEqual([
      [{ text: '불꽃', tone: 'rarity-primordial' }],
      [
        { text: '[강조]', tone: 'increase' },
        { text: ' 태초', tone: 'rarity-primordial' }
      ]
    ])
  })

  it('"레어 Ⅱ"처럼 단계가 붙은 등급은 등급 이름의 파일을 쓰고, 그 파일이 없는 선택지는 문구가 없다', () => {
    const board = oathSetBoardOf(CATALOG, setInfoOf('buffer'))

    expect(board?.options.map(({ effect }) => effect)).toEqual([
      null,
      [[{ text: '분노 레어', tone: 'rarity-rare' }]],
      null
    ])
  })

  it('데이터에 없는 세트는 선택지를 만들지 않는다', () => {
    expect(oathSetBoardOf(CATALOG, { ...setInfoOf('dealer'), setId: 50000 })).toBeNull()
  })
})

describe('서약 아이템 아이콘', () => {
  it('이름이 같은 서약은 등급까지 같은 아이콘을 고른다', () => {
    const item = { itemId: 'neople-hash', itemName: '영겁의 안개 서약' }

    expect(oathItemIconOf(CATALOG, { ...item, rarity: 'primordial' })).toBe(
      'oath-item/100610096.webp'
    )
    expect(oathItemIconOf(CATALOG, { ...item, rarity: 'rare' })).toBe('oath-item/100610094.webp')
  })

  it('데이터에 없는 이름이나 등급은 아이콘이 없다', () => {
    const item = { itemId: 'neople-hash', itemName: '영겁의 안개 서약', rarity: 'epic' } as const

    expect(oathItemIconOf(CATALOG, item)).toBeNull()
    expect(oathItemIconOf(CATALOG, { ...item, itemName: '없는 서약', rarity: 'rare' })).toBeNull()
    expect(oathItemIconOf(CATALOG, { ...item, rarity: null })).toBeNull()
  })
})
