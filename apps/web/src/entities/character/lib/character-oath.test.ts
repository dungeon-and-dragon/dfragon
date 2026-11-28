import { describe, expect, it } from 'vitest'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import { toOathView } from './character-oath'

const STEP_NAMES = [
  '첫 번째 진의',
  '두 번째 진의',
  '세 번째 진의',
  '네 번째 진의',
  '다섯 번째 진의',
  '여섯 번째 진의',
  '일곱 번째 진의',
  '여덟 번째 진의',
  '아홉 번째 진의'
]

function oathOf(role: 'dealer' | 'buffer') {
  const { oath } = characterDetailFixture(role)

  if (oath === null) {
    throw new Error(`${role} fixture에 서약이 없다`)
  }

  return oath
}

describe('서약 탭 값', () => {
  it('딜러의 서약, 세트, 결정과 진의 단계마다 고른 효과를 읽는다', () => {
    const view = toOathView(oathOf('dealer'))

    expect(view.info).toMatchObject({ itemName: '세계를 태우는 용투 서약', rarity: 'primordial' })
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
    expect(view.upgrade?.title).toBe('묵언의 진의')
    expect(view.upgrade?.steps).toEqual([
      { name: '첫 번째 진의', choice: 'cooldown' },
      { name: '두 번째 진의', choice: 'cooldown' },
      { name: '세 번째 진의', choice: 'cooldown' },
      { name: '네 번째 진의', choice: 'finalDamage' },
      { name: '다섯 번째 진의', choice: 'speed' },
      { name: '여섯 번째 진의', choice: 'speed' },
      { name: '일곱 번째 진의', choice: 'speed' },
      { name: '여덟 번째 진의', choice: 'speed' },
      { name: '아홉 번째 진의', choice: 'speed' }
    ])
  })

  it('버퍼의 단계가 붙은 세트 등급을 희귀도로 읽고, 진의를 배우지 않았어도 아홉 단계를 둔다', () => {
    const view = toOathView(oathOf('buffer'))

    expect(view.set).toMatchObject({ rarityName: '레어 Ⅱ', rarity: 'rare', point: 905 })
    expect(view.crystals.find(({ slot }) => slot === 1)?.tune).toBeNull()
    expect(view.upgrade?.title).toBe('묵언의 진의')
    expect(view.upgrade?.steps.map(({ name }) => name)).toEqual(STEP_NAMES)
    expect(view.upgrade?.steps.every(({ choice }) => choice === null)).toBe(true)
  })

  it('착용하지 않은 결정 칸 수를 11칸에서 센다', () => {
    const oath = oathOf('dealer')
    const crystal = oath.crystal.slice(0, 7)

    expect(toOathView(oath).emptyCrystalSlots).toBe(0)
    expect(toOathView({ ...oath, crystal }).emptyCrystalSlots).toBe(4)
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

  it('배우지 않은 단계와 선택지 이름을 모르는 단계는 고른 효과를 비운다', () => {
    const oath = oathOf('dealer')
    const info = oath.info
    const upgrade = info?.oathUpgrade

    if (info == null || upgrade == null) {
      throw new Error('dealer fixture에 진의가 없다')
    }

    const [first, second] = upgrade.options
    const unknown = { ...second, optionName: '알 수 없는 선택지' }
    const withUnknown = { ...info, oathUpgrade: { ...upgrade, options: [first, unknown] } }

    const choices = toOathView({ ...oath, info: withUnknown }).upgrade?.steps.map(
      ({ choice }) => choice
    )

    expect(choices).toEqual(['cooldown', null, null, null, null, null, null, null, null])
  })

  it('내용이 빈 서약도 실패하지 않고 빈 값으로 읽는다', () => {
    expect(toOathView({ info: null, crystal: [], blessing: null, setInfo: null })).toEqual({
      info: null,
      set: null,
      crystals: [],
      emptyCrystalSlots: 11,
      upgrade: null
    })
  })
})
