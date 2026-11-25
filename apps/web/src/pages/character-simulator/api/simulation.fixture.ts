import { findWeaponVariant, oathUpgradeSteps } from '@dfragon/lib/equipment-variants'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import type { CharacterCardScore, CharacterDetailView } from '#entities/character'
import type { SimulationBody } from '#pages/character-simulator/model/simulator-draft'
import { toSimulatorSwitching } from '#pages/character-simulator/model/simulator-switching'
import type { EquipmentSimulation } from './useEquipmentSimulation'

// 엔진을 열지 않고 바꾼 부위마다 점수를 정해진 만큼 더하는 합성 결과다. 실제 점수 계산과 관계없다.
const VERSIONS = { package: 'story', rulesRev: 'story', bundleId: 'story' }
const BASELINE = { equipment: 1_741_052, buff: 4_120_385 } as const
const POINTS_PER_REINFORCE = 3_100
const AMPLIFY_POINTS = 12_400
const ENCHANT_POINTS = 8_200
const SLOT_ITEM_POINTS = 15_300
const VARIANT_POINTS = 21_700
const POINTS_PER_TUNE = 4_600
const POINTS_PER_POTENCY = 310
const POINTS_PER_RELEASE = 520
const EQUIPMENT_SET_POINTS = 64_500
const OATH_SET_POINTS = 18_900
const OATH_BODY_POINTS = 27_300
const POINTS_PER_UPGRADE_STEP = 9_100
const POINTS_PER_UPGRADE_OATHPOINT = 5_200
const AVATAR_PRESET_POINTS = 33_800
const POINTS_PER_BUFF_LEVEL = 7_400
const POINTS_PER_SWITCHING_EQUIPMENT = 4_100

type Calculator = CharacterCardScore['calculator']

// Storybook에서 서약 본체 그림이 보이도록 운영 사이트의 서약 데이터 묶음 2ca27db1판 그림을 쓴다. 이름과 등급도 그 판의 값이다.
const OATH_ART = 'https://dfragon.com/skilltab/2ca27db1/oath-item'

export const simulatorOathCatalog = {
  ...oathCatalogFixture.characterDetail,
  items: [
    {
      name: '전장을 태우는 용투 서약',
      rarity: '유니크',
      icon: `${OATH_ART}/100313758.0f5b0fb8.webp`
    },
    {
      name: '하늘을 태우는 용투 서약',
      rarity: '레전더리',
      icon: `${OATH_ART}/100313759.4c688687.webp`
    },
    {
      name: '대지를 태우는 용투 서약',
      rarity: '에픽',
      icon: `${OATH_ART}/100610080.268bb3af.webp`
    },
    { name: '세계를 태우는 용투 서약', rarity: '태초', icon: `${OATH_ART}/100610081.d3308fec.webp` }
  ]
}

export function simulationScore(
  calculator: Calculator,
  score: Partial<CharacterCardScore> = {}
): CharacterCardScore {
  return {
    calculator,
    value: BASELINE[calculator],
    skipped: null,
    approximate: null,
    versions: VERSIONS,
    ...score
  }
}

export function calculatorOf(detail: CharacterDetailView): Calculator {
  if (detail.card?.role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

type Tunes = readonly Readonly<{ level: number | null }>[]

function wornTuneOf(tunes: Tunes): number {
  return Math.max(0, ...tunes.map(({ level }) => level ?? 0))
}

function oathPointsOf(detail: CharacterDetailView, oath: SimulationBody['oath'] = []): number {
  const crystals = detail.oath?.crystal ?? []

  return oath.reduce((sum, { slotNo, tune, variantId }) => {
    const crystal = crystals.find((candidate) => candidate.slotNo === slotNo)
    const worn = crystal?.tune?.level ?? 0
    const tunePoints = tune !== null ? (tune - worn) * POINTS_PER_TUNE : 0
    const variantPoints = variantId !== null ? VARIANT_POINTS : 0

    return sum + tunePoints + variantPoints
  }, 0)
}

// 엔진은 진의를 해금한 단계 수와 서약 포인트를 고른 단계 수로만 다르게 계산한다.
function isOathpointOption(option: string | null): boolean {
  return oathUpgradeSteps().some(({ options }) =>
    options.some((candidate) => candidate.kind === 'Oathpoint' && candidate.option === option)
  )
}

function upgradePointsOf(detail: CharacterDetailView, oathUpgrade: SimulationBody['oathUpgrade']) {
  if (oathUpgrade === undefined) {
    return 0
  }

  const worn = detail.oath?.info?.oathUpgrade?.options ?? []
  const wornOathpoints = worn.filter(({ optionName }) => isOathpointOption(optionName)).length
  const oathpoints = oathUpgrade.filter(({ option }) => isOathpointOption(option)).length
  const stepPoints = (oathUpgrade.length - worn.length) * POINTS_PER_UPGRADE_STEP

  return stepPoints + (oathpoints - wornOathpoints) * POINTS_PER_UPGRADE_OATHPOINT
}

function buffLevelPointsOf(detail: CharacterDetailView, buffLevel: number | undefined): number {
  if (buffLevel === undefined) {
    return 0
  }

  const worn = detail.buff.equipment?.skillInfo?.option?.level ?? buffLevel

  return (buffLevel - worn) * POINTS_PER_BUFF_LEVEL
}

function switchingEquipmentPointsOf(
  detail: CharacterDetailView,
  switchingEquipment: number | undefined
): number {
  if (switchingEquipment === undefined) {
    return 0
  }

  const worn = toSimulatorSwitching(detail, 'dealer')?.equipment?.count ?? switchingEquipment

  return (switchingEquipment - worn) * POINTS_PER_SWITCHING_EQUIPMENT
}

function setPointsOf(
  detail: CharacterDetailView,
  { equipmentSet, oathSet, oathBody, oathUpgrade }: SimulationBody
): number {
  const equipmentSetPoints = equipmentSet !== undefined ? EQUIPMENT_SET_POINTS : 0
  const oathSetPoints = oathSet !== undefined ? OATH_SET_POINTS : 0
  const oathBodyPoints = oathBody !== undefined ? OATH_BODY_POINTS : 0

  return equipmentSetPoints + oathSetPoints + oathBodyPoints + upgradePointsOf(detail, oathUpgrade)
}

function pointsOf(detail: CharacterDetailView, body: SimulationBody): number {
  const {
    equipment,
    oath,
    equipmentSet: _set,
    oathSet: _oathSet,
    oathBody: _body,
    oathUpgrade: _upgrade,
    avatarPreset,
    buffLevel,
    switchingEquipment,
    ...slotItems
  } = body
  const items = detail.equipment.equipment
  const slotItemPoints = Object.keys(slotItems).length * SLOT_ITEM_POINTS
  const avatarPoints = avatarPreset !== undefined ? AVATAR_PRESET_POINTS : 0
  const characterPoints =
    avatarPoints +
    buffLevelPointsOf(detail, buffLevel) +
    switchingEquipmentPointsOf(detail, switchingEquipment)

  return equipment.reduce(
    (sum, change) => {
      const item = items.find(({ slotId }) => slotId === change.slotId)
      const reinforce = (change.reinforce - (item?.reinforce ?? 0)) * POINTS_PER_REINFORCE
      const amplified = change.amplified !== (item?.amplificationName != null) ? AMPLIFY_POINTS : 0
      const enchant = change.enchantId !== null ? ENCHANT_POINTS : 0
      const variant = change.variantId !== null ? VARIANT_POINTS : 0
      const tune =
        change.tune !== null ? (change.tune - wornTuneOf(item?.tune ?? [])) * POINTS_PER_TUNE : 0
      const potency = change.potency !== null ? change.potency * POINTS_PER_POTENCY : 0
      const release = change.release !== null ? change.release * POINTS_PER_RELEASE : 0

      return sum + reinforce + amplified + enchant + variant + tune + potency + release
    },
    slotItemPoints + characterPoints + oathPointsOf(detail, oath) + setPointsOf(detail, body)
  )
}

export function syntheticSimulation(
  detail: CharacterDetailView,
  body: SimulationBody
): EquipmentSimulation {
  const calculator = calculatorOf(detail)
  const baseline = simulationScore(calculator)
  const value = BASELINE[calculator] + pointsOf(detail, body)
  const simulated = simulationScore(calculator, { value })

  return { baseline, simulated }
}

// 해방 계열 무기를 낀 캐릭터의 무기를 해방 수치가 덜 찬 "억압 - " 아이템으로 바꾼 합성 캐릭터다.
export function withPendingReleaseWeapon(
  detail: CharacterDetailView,
  release: number
): CharacterDetailView {
  const equipment = detail.equipment.equipment.map((item) => {
    const match = item.itemId !== null ? findWeaponVariant(item.itemId) : null
    const pending = match?.variant.releasePending

    if (pending === undefined) {
      return item
    }

    return {
      ...item,
      itemId: pending.itemId,
      itemName: pending.itemName,
      weaponRelease: { value: release }
    }
  })

  return { ...detail, equipment: { ...detail.equipment, equipment } }
}

// 무기를 끼지 않은 합성 캐릭터다.
export function withoutWeapon(detail: CharacterDetailView): CharacterDetailView {
  const equipment = detail.equipment.equipment.filter(({ slotId }) => slotId !== 'WEAPON')

  return { ...detail, equipment: { ...detail.equipment, equipment } }
}

const EMPTIED_SLOTS = ['WEAPON', 'TITLE', 'JACKET']

// 무기, 칭호, 상의, 크리쳐, 오라를 끼지 않은 합성 캐릭터다.
export function withEmptySlots(detail: CharacterDetailView): CharacterDetailView {
  const equipment = detail.equipment.equipment.filter(
    ({ slotId }) => slotId === null || !EMPTIED_SLOTS.includes(slotId)
  )
  const avatar = detail.avatar.filter(({ slotId }) => slotId !== 'AURORA')

  return { ...detail, equipment: { ...detail.equipment, equipment }, creature: null, avatar }
}

const TWISTED_SWITCHING_SLOTS = ['SUPPORT', 'MAGIC_STON', 'EARRING']

export function withSwitchingEquipment(
  detail: CharacterDetailView,
  count: number
): CharacterDetailView {
  const buff = detail.buff.equipment

  if (buff === null) {
    return detail
  }

  const skillName = buff.skillInfo?.name
  const slots = detail.equipment.equipment.filter(({ slotId }) => slotId !== 'TITLE')
  const equipment = slots.slice(0, count).map((item) => {
    const twisted = TWISTED_SWITCHING_SLOTS.includes(item.slotId ?? '')
    const prefix = twisted ? '짙은 뒤틀린 심연의' : '짙은 심연의 편린'

    return { ...item, itemName: `${prefix} ${item.slotName} : ${skillName}` }
  })

  return { ...detail, buff: { ...detail.buff, equipment: { ...buff, equipment } } }
}
