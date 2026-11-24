import {
  oathCrystalVariantsOf,
  oathVariantOf,
  oathVariantsOf
} from '@dfragon/lib/equipment-variants'
import { expect, it } from 'vitest'
import type { CharacterDetailView } from '#entities/character'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import {
  hasChanges,
  NO_CHANGES,
  type SimulatorAction,
  type SimulatorChanges,
  simulationBody,
  simulatorReducer,
  toSimulatorRows
} from './simulator-draft'
import {
  crystalChoicesOf,
  crystalDraftOf,
  crystalItemOf,
  crystalTuneLimitOf,
  oathBodyItemOf,
  oathInSet,
  type SimulatorOath,
  toSimulatorOath
} from './simulator-oath'

// 두 fixture 모두 야망의 용투 서약 세트다. 딜러는 태초 용투 서약과 완전한(에픽) 8개, 태초 3개 결정을, 버퍼는 세트에 속하지
// 않는 영겁의 안개 서약을 낀다.
const DRAGON_SET = 16204
const SHADOW_SET = 16201
// 광휘 결정이 아닌 결정이다.
const MIST_CRYSTAL_ID = 'f834b16af8341719efe94a3be49d381e'

function apply(changes: SimulatorChanges, ...actions: SimulatorAction[]): SimulatorChanges {
  return actions.reduce(simulatorReducer, changes)
}

function idsOf(choices: readonly { id: string }[]): string[] {
  return choices.map(({ id }) => id)
}

function crystalId(setId: number, rarity: string): string {
  const found = oathCrystalVariantsOf(setId).find((crystal) => crystal.rarity === rarity)
  expect(found, `${setId} ${rarity}`).toBeDefined()

  return found!.id
}

function withCrystal(
  detail: CharacterDetailView,
  slotNo: number,
  crystal: Partial<NonNullable<CharacterDetailView['oath']>['crystal'][number]>
): CharacterDetailView {
  const oath = detail.oath!
  const crystals = oath.crystal.map((current) =>
    current.slotNo === slotNo ? { ...current, ...crystal } : current
  )

  return { ...detail, oath: { ...oath, crystal: crystals } }
}

const dealerOath = toSimulatorOath(characterDetailFixture('dealer'))!
const bufferOath = toSimulatorOath(characterDetailFixture('buffer'))!

function viewOf(oath: SimulatorOath, changes: SimulatorChanges): SimulatorOath {
  return oathInSet(oath, changes.oath.set)
}

function crystalAt(oath: SimulatorOath, slotNo: number) {
  const found = oath.crystals.find((crystal) => crystal.slotNo === slotNo)
  expect(found, String(slotNo)).toBeDefined()

  return found!
}

function bodyChoiceIds(setId: number): string[] {
  return idsOf([...oathVariantsOf(setId), ...oathVariantsOf(null)])
}

it('서약은 착용한 세트, 그 세트 전용 서약과 영겁의 안개 서약 4등급씩의 본체 선택지와 그 세트 광휘 결정 4등급의 결정 선택지를 둔다', () => {
  const [first] = dealerOath.crystals

  expect(dealerOath.setId).toBe(DRAGON_SET)
  expect(dealerOath.sets).toHaveLength(12)
  expect(idsOf(dealerOath.body!.choices)).toEqual(bodyChoiceIds(DRAGON_SET))
  expect(dealerOath.body!.wornVariantId).toBe(oathVariantOf(DRAGON_SET, '태초')?.id)
  expect(idsOf(bufferOath.body!.choices)).toEqual(bodyChoiceIds(DRAGON_SET))
  expect(bufferOath.body!.wornVariantId).toBe(oathVariantOf(null, '에픽')?.id)
  expect(dealerOath.crystals.map(({ slotNo }) => slotNo)).toEqual([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
  ])
  expect(idsOf(first!.choices)).toEqual(idsOf(oathCrystalVariantsOf(DRAGON_SET)))
  expect(first!.wornVariantId).toBe(crystalId(DRAGON_SET, '에픽'))
  expect(toSimulatorOath({ oath: null })).toBeNull()
})

it('서약 세트를 고르면 본체와 광휘 결정이 그 세트의 같은 등급이 되고 조율은 그대로이며 세트만 요청한다', () => {
  const changed = apply(NO_CHANGES, { type: 'oathSet', oath: dealerOath, setId: SHADOW_SET })
  const view = viewOf(dealerOath, changed)

  expect(changed.oath).toEqual({ set: SHADOW_SET, body: null, crystals: {}, upgrade: null })
  expect(oathBodyItemOf(view.body!, changed.oath).itemName).toBe('태초의 어둠 속 그림자 서약')
  expect(view.crystals.map(({ wornVariantId }) => wornVariantId)).toEqual([
    ...Array.from({ length: 8 }, () => crystalId(SHADOW_SET, '에픽')),
    ...Array.from({ length: 3 }, () => crystalId(SHADOW_SET, '태초'))
  ])
  expect(view.crystals.map(({ wornTune }) => wornTune)).toEqual([3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0])
  expect(simulationBody(toSimulatorRows(characterDetailFixture('dealer')), view, changed)).toEqual({
    equipment: [],
    oathSet: SHADOW_SET
  })
  expect(apply(changed, { type: 'oathSet', oath: dealerOath, setId: DRAGON_SET })).toEqual(
    NO_CHANGES
  )
})

it('서약 세트를 바꿔도 영겁의 안개 서약과 광휘 결정이 아닌 결정은 그대로 둔다', () => {
  const detail = withCrystal(characterDetailFixture('buffer'), 3, {
    itemId: MIST_CRYSTAL_ID,
    itemName: '희미한 안개 결정',
    itemRarity: '유니크'
  })
  const oath = toSimulatorOath(detail)!
  const changed = apply(NO_CHANGES, { type: 'oathSet', oath, setId: SHADOW_SET })
  const view = viewOf(oath, changed)
  const mistCrystal = crystalAt(view, 3)

  expect(idsOf(view.body!.choices)).toEqual(bodyChoiceIds(SHADOW_SET))
  expect(view.body!.wornVariantId).toBe(oathVariantOf(null, '에픽')?.id)
  expect(oathBodyItemOf(view.body!, changed.oath)).toMatchObject({
    itemName: '영겁의 안개 서약',
    rarity: 'epic'
  })
  expect(mistCrystal.wornVariantId).toBeNull()
  expect(crystalItemOf(mistCrystal, changed.oath).itemName).toBe('희미한 안개 결정')
  expect(idsOf(mistCrystal.choices)).toEqual(idsOf(oathCrystalVariantsOf(SHADOW_SET)))
  expect(bufferOath.body!.setBound).toBe(false)
})

it('서약 본체는 본체 선택지 가운데 고르고, 착용한 등급을 다시 고르면 지운다', () => {
  const epic = oathVariantOf(DRAGON_SET, '에픽')!
  const changed = apply(NO_CHANGES, { type: 'oathBody', body: dealerOath.body!, id: epic.id })

  expect(changed.oath.body).toBe(epic.id)
  expect(oathBodyItemOf(dealerOath.body!, changed.oath).itemName).toBe(epic.item.itemName)
  expect(simulationBody([], dealerOath, changed)).toEqual({ equipment: [], oathBody: epic.id })
  expect(
    apply(changed, {
      type: 'oathBody',
      body: dealerOath.body!,
      id: dealerOath.body!.wornVariantId!
    })
  ).toEqual(NO_CHANGES)
  expect(
    apply(NO_CHANGES, {
      type: 'oathBody',
      body: dealerOath.body!,
      id: crystalId(DRAGON_SET, '에픽')
    })
  ).toEqual(NO_CHANGES)
})

it('서약 본체는 세트 전용 서약과 영겁의 안개 서약 사이에서 바꿀 수 있고 고른 선택지 id를 요청한다', () => {
  const dragonPrimeval = oathVariantOf(DRAGON_SET, '태초')!
  const mistPrimeval = oathVariantOf(null, '태초')!
  const toSet = apply(NO_CHANGES, {
    type: 'oathBody',
    body: bufferOath.body!,
    id: dragonPrimeval.id
  })
  const toMist = apply(NO_CHANGES, {
    type: 'oathBody',
    body: dealerOath.body!,
    id: mistPrimeval.id
  })

  expect(oathBodyItemOf(bufferOath.body!, toSet.oath).itemName).toBe('세계를 태우는 용투 서약')
  expect(simulationBody([], bufferOath, toSet)).toEqual({
    equipment: [],
    oathBody: dragonPrimeval.id
  })
  expect(oathBodyItemOf(dealerOath.body!, toMist.oath)).toMatchObject({
    itemName: '영겁의 안개 서약',
    rarity: 'primordial'
  })
  expect(simulationBody([], dealerOath, toMist)).toEqual({
    equipment: [],
    oathBody: mistPrimeval.id
  })
})

it('서약 세트를 바꾸면 고른 세트 전용 서약은 새 세트의 같은 등급으로 옮기고 고른 영겁의 안개 서약은 그대로 둔다', () => {
  const setChosen = apply(
    NO_CHANGES,
    { type: 'oathBody', body: bufferOath.body!, id: oathVariantOf(DRAGON_SET, '레전더리')!.id },
    { type: 'oathSet', oath: bufferOath, setId: SHADOW_SET }
  )
  const mistChosen = apply(
    NO_CHANGES,
    { type: 'oathBody', body: dealerOath.body!, id: oathVariantOf(null, '레전더리')!.id },
    { type: 'oathSet', oath: dealerOath, setId: SHADOW_SET }
  )

  expect(setChosen.oath.body).toBe(oathVariantOf(SHADOW_SET, '레전더리')!.id)
  expect(mistChosen.oath.body).toBe(oathVariantOf(null, '레전더리')!.id)
  expect(oathBodyItemOf(viewOf(dealerOath, mistChosen).body!, mistChosen.oath).itemName).toBe(
    '영겁의 안개 서약'
  )
})

it('결정 등급을 바꾸면 조율을 새 결정의 최대 단계로 자르고, 바꾼 결정만 선택지 id와 조율로 요청한다', () => {
  const primeval = crystalId(DRAGON_SET, '태초')
  const unique = crystalId(DRAGON_SET, '유니크')
  const epic = crystalId(DRAGON_SET, '에픽')
  const changed = apply(
    NO_CHANGES,
    {
      type: 'crystal',
      oath: dealerOath,
      crystal: crystalAt(dealerOath, 9),
      draft: { variantId: epic }
    },
    {
      type: 'crystal',
      oath: dealerOath,
      crystal: crystalAt(dealerOath, 6),
      draft: { variantId: primeval }
    },
    {
      type: 'crystal',
      oath: dealerOath,
      crystal: crystalAt(dealerOath, 0),
      draft: { variantId: unique }
    },
    { type: 'crystal', oath: dealerOath, crystal: crystalAt(dealerOath, 7), draft: { tune: 2 } }
  )

  expect(crystalDraftOf(crystalAt(dealerOath, 6), changed.oath)).toEqual({
    variantId: primeval,
    tune: 0
  })
  expect(crystalDraftOf(crystalAt(dealerOath, 0), changed.oath)).toEqual({
    variantId: unique,
    tune: 3
  })
  expect(simulationBody([], dealerOath, changed).oath).toEqual([
    { slotNo: 0, tune: 3, variantId: unique },
    { slotNo: 6, tune: 0, variantId: primeval },
    { slotNo: 7, tune: 2, variantId: null },
    { slotNo: 9, tune: 0, variantId: epic }
  ])
})

it('결정의 단계를 넘는 조율, 조율할 수 없는 태초 결정의 조율, 다른 선택지의 결정은 받지 않는다', () => {
  expect(crystalTuneLimitOf(crystalAt(dealerOath, 8), crystalAt(dealerOath, 8).wornVariantId)).toBe(
    0
  )
  expect(
    apply(
      NO_CHANGES,
      { type: 'crystal', oath: dealerOath, crystal: crystalAt(dealerOath, 7), draft: { tune: 4 } },
      { type: 'crystal', oath: dealerOath, crystal: crystalAt(dealerOath, 8), draft: { tune: 1 } },
      {
        type: 'crystal',
        oath: dealerOath,
        crystal: crystalAt(dealerOath, 0),
        draft: { variantId: crystalId(SHADOW_SET, '에픽') }
      }
    )
  ).toEqual(NO_CHANGES)
})

it('광휘 결정이 아닌 착용 결정은 광휘 결정으로 바꿨다가 착용 중으로 되돌리면 요청에서 뺀다', () => {
  const oath = toSimulatorOath(
    withCrystal(characterDetailFixture('dealer'), 2, {
      itemId: MIST_CRYSTAL_ID,
      itemName: '희미한 안개 결정',
      itemRarity: '유니크',
      tune: { level: 0, setPoint: 85 }
    })
  )!
  const crystal = crystalAt(oath, 2)
  const changed = apply(NO_CHANGES, {
    type: 'crystal',
    oath,
    crystal,
    draft: { variantId: crystalId(DRAGON_SET, '에픽') }
  })

  expect(crystal.wornVariantId).toBeNull()
  expect(idsOf(crystal.choices)).toEqual(idsOf(oathCrystalVariantsOf(DRAGON_SET)))
  expect(hasChanges(changed)).toBe(true)
  expect(apply(changed, { type: 'crystal', oath, crystal, draft: { variantId: null } })).toEqual(
    NO_CHANGES
  )
})

it('서약 세트를 바꾸면 고른 본체와 결정 등급을 새 세트의 같은 등급으로 옮기고 조율은 유지한다', () => {
  const shadowEpicBody = oathVariantOf(SHADOW_SET, '에픽')!.id
  const changed = apply(
    NO_CHANGES,
    { type: 'oathBody', body: dealerOath.body!, id: oathVariantOf(DRAGON_SET, '에픽')!.id },
    {
      type: 'crystal',
      oath: dealerOath,
      crystal: crystalAt(dealerOath, 0),
      draft: { variantId: crystalId(DRAGON_SET, '유니크') }
    },
    { type: 'crystal', oath: dealerOath, crystal: crystalAt(dealerOath, 7), draft: { tune: 2 } },
    { type: 'oathSet', oath: dealerOath, setId: SHADOW_SET }
  )
  const view = viewOf(dealerOath, changed)

  expect(changed.oath.body).toBe(shadowEpicBody)
  expect(changed.oath.crystals).toEqual({
    0: { variantId: crystalId(SHADOW_SET, '유니크'), tune: 3 },
    7: { variantId: crystalId(SHADOW_SET, '에픽'), tune: 2 }
  })
  expect(simulationBody([], view, changed)).toEqual({
    equipment: [],
    oathSet: SHADOW_SET,
    oathBody: shadowEpicBody,
    oath: [
      { slotNo: 0, tune: 3, variantId: crystalId(SHADOW_SET, '유니크') },
      { slotNo: 7, tune: 2, variantId: null }
    ]
  })
  expect(apply(changed, { type: 'reset' })).toEqual(NO_CHANGES)
})

it('태초 결정이 이미 3개면 다른 결정의 선택지에 태초가 없고, 하나를 내리면 다시 생긴다', () => {
  const primeval = crystalId(DRAGON_SET, '태초')
  const epic = crystalId(DRAGON_SET, '에픽')
  const crystal = crystalAt(dealerOath, 0)
  const lowered = apply(NO_CHANGES, {
    type: 'crystal',
    oath: dealerOath,
    crystal: crystalAt(dealerOath, 8),
    draft: { variantId: epic }
  })

  expect(idsOf(crystalChoicesOf(dealerOath, crystal, NO_CHANGES.oath))).not.toContain(primeval)
  expect(idsOf(crystalChoicesOf(dealerOath, crystalAt(dealerOath, 8), NO_CHANGES.oath))).toContain(
    primeval
  )
  expect(
    apply(NO_CHANGES, {
      type: 'crystal',
      oath: dealerOath,
      crystal,
      draft: { variantId: primeval }
    })
  ).toEqual(NO_CHANGES)
  expect(idsOf(crystalChoicesOf(dealerOath, crystal, lowered.oath))).toContain(primeval)
  expect(
    crystalDraftOf(
      crystal,
      apply(lowered, { type: 'crystal', oath: dealerOath, crystal, draft: { variantId: primeval } })
        .oath
    ).variantId
  ).toBe(primeval)
})

it('결정 선택지는 서약 세트의 광휘 결정이고, 다른 세트의 광휘 결정을 낀 결정은 착용 중으로 두며 세트를 고르면 그 세트로 옮긴다', () => {
  const shadowEpic = crystalId(SHADOW_SET, '에픽')
  const oath = toSimulatorOath(
    withCrystal(characterDetailFixture('dealer'), 4, {
      itemId: shadowEpic,
      itemName: '그림자 : 완전한 광휘 결정',
      itemRarity: '에픽'
    })
  )!
  const crystal = crystalAt(oath, 4)
  const changed = apply(NO_CHANGES, { type: 'oathSet', oath, setId: DRAGON_SET })

  expect(idsOf(crystal.choices)).toEqual(idsOf(oathCrystalVariantsOf(DRAGON_SET)))
  expect(crystal.wornVariantId).toBeNull()
  expect(changed.oath.set).toBe(DRAGON_SET)
  expect(crystalAt(viewOf(oath, changed), 4).wornVariantId).toBe(crystalId(DRAGON_SET, '에픽'))
  expect(apply(NO_CHANGES, { type: 'oathSet', oath: dealerOath, setId: DRAGON_SET })).toEqual(
    NO_CHANGES
  )
})

it('서약 세트가 선택 목록에 없으면 결정 선택지를 두지 않는다', () => {
  const detail = characterDetailFixture('dealer')
  const setInfo = { ...detail.oath!.setInfo!, setId: 16213 }
  const oath = toSimulatorOath({ oath: { ...detail.oath!, setInfo } })!

  expect(oath.setId).toBeNull()
  expect(oath.crystals.every(({ choices }) => choices.length === 0)).toBe(true)
  expect(crystalTuneLimitOf(crystalAt(oath, 7), null)).toBe(3)
})

const PACK_SET = 16211

// 응답에 서약 세트가 없는 캐릭터처럼 안개 서약 본체에 미광의 서약 결정 3개와 무리 광휘 결정 8개를 낀다.
function withoutSetInfo(detail: CharacterDetailView): CharacterDetailView {
  const oath = detail.oath!
  const glimmer = { itemId: MIST_CRYSTAL_ID, itemName: '미광의 서약 결정', itemRarity: '레어' }
  const packOf = (rarity: string, setPoint: number) => {
    const { item } = oathCrystalVariantsOf(PACK_SET).find((crystal) => crystal.rarity === rarity)!

    return { ...item, tune: { level: 0, setPoint } }
  }

  const worn = [
    ...Array.from({ length: 3 }, () => ({ ...glimmer, tune: { level: 0, setPoint: 45 } })),
    ...Array.from({ length: 4 }, () => packOf('유니크', 85)),
    ...Array.from({ length: 3 }, () => packOf('레전더리', 125)),
    packOf('태초', 205)
  ]

  const crystal = oath.crystal.map((current, index) => ({ ...current, ...worn[index] }))

  return { ...detail, oath: { ...oath, setInfo: null, crystal } }
}

it('응답에 서약 세트가 없으면 세트 포인트 합이 가장 큰 세트를 지금 세트로 두고 그 세트의 결정 선택지를 연다', () => {
  const oath = toSimulatorOath(withoutSetInfo(characterDetailFixture('buffer')))!

  expect(oath.setId).toBe(PACK_SET)
  expect(oath.rarity).toBeNull()
  expect(idsOf(crystalAt(oath, 0).choices)).toEqual(idsOf(oathCrystalVariantsOf(PACK_SET)))
  expect(crystalAt(oath, 0).wornVariantId).toBeNull()
  expect(crystalAt(oath, 10).wornVariantId).toBe(crystalId(PACK_SET, '태초'))
})

it('응답에 서약 세트가 없는 캐릭터도 서약 세트를 고르면 무리 광휘 결정을 그 세트로 옮겨 세트를 요청한다', () => {
  const detail = withoutSetInfo(characterDetailFixture('buffer'))
  const oath = toSimulatorOath(detail)!
  const changed = apply(NO_CHANGES, { type: 'oathSet', oath, setId: SHADOW_SET })
  const view = viewOf(oath, changed)

  expect(crystalAt(view, 3).wornVariantId).toBe(crystalId(SHADOW_SET, '유니크'))
  expect(crystalAt(view, 0).wornVariantId).toBeNull()
  expect(simulationBody(toSimulatorRows(detail), view, changed)).toEqual({
    equipment: [],
    oathSet: SHADOW_SET
  })
  expect(apply(NO_CHANGES, { type: 'oathSet', oath, setId: PACK_SET })).toEqual(NO_CHANGES)
})

it('응답에 서약 세트가 없고 세트에 속한 본체와 광휘 결정도 없으면 결정 선택지를 두지 않는다', () => {
  const detail = withoutSetInfo(characterDetailFixture('buffer'))
  const crystal = detail.oath!.crystal.map((current) => ({
    ...current,
    itemId: MIST_CRYSTAL_ID,
    itemName: '미광의 서약 결정',
    itemRarity: '레어'
  }))
  const oath = toSimulatorOath({ oath: { ...detail.oath!, crystal } })!

  expect(oath.setId).toBeNull()
  expect(oath.crystals.every(({ choices }) => choices.length === 0)).toBe(true)
  expect(idsOf(oath.body!.choices)).toEqual(idsOf(oathVariantsOf(null)))
})

it('서약 세트를 골라도 조율 정보가 없는 광휘 밖 착용 결정은 조율까지 그대로 두고 요청에 넣지 않는다', () => {
  const oath = toSimulatorOath(
    withCrystal(characterDetailFixture('dealer'), 2, {
      itemId: MIST_CRYSTAL_ID,
      itemName: '목록에 없는 결정',
      itemRarity: '유니크',
      tune: { level: 2, setPoint: 105 }
    })
  )!
  const changed = apply(NO_CHANGES, { type: 'oathSet', oath, setId: SHADOW_SET })
  const view = viewOf(oath, changed)

  expect(changed.oath.crystals).toEqual({})
  expect(crystalDraftOf(crystalAt(view, 2), changed.oath)).toEqual({ variantId: null, tune: 2 })
  expect(simulationBody([], view, changed)).toEqual({ equipment: [], oathSet: SHADOW_SET })
})
