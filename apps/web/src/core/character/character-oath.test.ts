import { describe, expect, it } from 'vitest'
import { characterDetailFixture } from '../testing/character-detail'
import { toOathView } from './character-oath'

function oathOf(role: 'dealer' | 'buffer') {
  const { oath } = characterDetailFixture(role)

  if (oath === null) {
    throw new Error(`${role} fixture에 서약이 없다`)
  }

  return oath
}

describe('서약 탭 값', () => {
  it('딜러의 서약, 세트, 결정, 세트 효과, 가호와 진의 단계를 응답과 같게 읽는다', () => {
    const view = toOathView(oathOf('dealer'))

    expect(view.info).toMatchObject({
      itemName: '세계를 태우는 용투 서약',
      rarity: 'primordial',
      setPoint: 655
    })
    expect(view.set).toEqual({
      name: '야망의 용투 서약',
      optionName: '용투 : 세계를 태우는 불꽃',
      rarityName: '태초',
      rarity: 'primordial',
      point: 2780
    })
    expect(view.crystals.find(({ slot }) => slot === 1)).toMatchObject({
      slot: 1,
      itemName: '용투 : 완전한 광휘 결정',
      rarity: 'epic',
      tune: 'III',
      setPoint: 195
    })
    expect(view.setStatus).toEqual([
      { name: '최종 데미지 증가', value: '500%' },
      { name: '버프력', value: '35,500' },
      { name: '모험가 명성', value: '18,000' }
    ])
    expect(view.blessing[2]).toEqual({ name: '버프력', value: '10,780' })
    expect(view.upgrade?.title).toBe('묵언의 진의')
    expect(view.upgrade?.lines.slice(0, 2)).toEqual([
      { name: '<묵언의 진의> - 첫 번째 진의', value: '고요한 호흡' },
      { name: '<묵언의 진의> - 두 번째 진의', value: '자애의 마음' }
    ])
    expect(view.upgrade?.lines.slice(9, 11)).toEqual([
      { name: '스킬 쿨타임 감소', value: '22.1%' },
      { name: '모험가 명성', value: '3,600' }
    ])
  })

  it('버퍼의 단계가 붙은 세트 등급을 희귀도로 읽고, 진의가 없으면 비운다', () => {
    const view = toOathView(oathOf('buffer'))

    expect(view.set).toMatchObject({ rarityName: '레어 Ⅱ', rarity: 'rare', point: 905 })
    expect(view.setStatus).toEqual([])
    expect(view.crystals.find(({ slot }) => slot === 1)?.tune).toBeNull()
    expect(view.upgrade).toBeNull()
  })

  it('결정을 세트 포인트가 높은 순으로 두고, 같으면 칸 번호 순으로 둔다', () => {
    const dealer = toOathView(oathOf('dealer'))
    // 버퍼 fixture의 슬롯 5, 6은 165, 7은 125, 나머지는 85점이다.
    const buffer = toOathView(oathOf('buffer'))

    expect(dealer.crystals.map(({ slot, setPoint }) => [slot, setPoint])).toEqual([
      [9, 205],
      [10, 205],
      [11, 205],
      [1, 195],
      [2, 195],
      [3, 195],
      [4, 195],
      [5, 195],
      [6, 195],
      [7, 175],
      [8, 165]
    ])
    expect(buffer.crystals.map(({ slot }) => slot)).toEqual([5, 6, 7, 1, 2, 3, 4, 8, 9, 10, 11])
  })

  it('응답의 결정 순서가 칸 번호 순이 아니어도 같은 세트 포인트는 칸 번호 순으로 둔다', () => {
    const oath = oathOf('dealer')

    const sorted = toOathView(oath).crystals
    const fromReversed = toOathView({ ...oath, crystal: [...oath.crystal].reverse() }).crystals

    expect(fromReversed).toEqual(sorted)
  })

  it('세트 포인트가 없는 결정은 뒤에 둔다', () => {
    const oath = oathOf('dealer')
    const crystal = oath.crystal.map((item, index) =>
      index === 8 ? { ...item, tune: null } : item
    )

    const slots = toOathView({ ...oath, crystal }).crystals.map(({ slot }) => slot)

    expect(slots).toEqual([10, 11, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('내용이 빈 서약도 실패하지 않고 빈 값으로 읽는다', () => {
    expect(toOathView({ info: null, crystal: [], blessing: null, setInfo: null })).toEqual({
      info: null,
      set: null,
      crystals: [],
      setStatus: [],
      blessing: [],
      upgrade: null
    })
  })
})
