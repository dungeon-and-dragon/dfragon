import { oathUpgradeSteps } from '@dfragon/lib/equipment-variants'
import type { ItemRarity } from './character-detail-display'
import type { CharacterDetailView } from '#entities/character/model/character-detail-view'
import { type ItemView, itemRarityOfGrade, toItemView, tuneNumeral } from './character-item'

type Oath = NonNullable<CharacterDetailView['oath']>
type OathUpgrade = NonNullable<NonNullable<Oath['info']>['oathUpgrade']>

const UPGRADE_TITLE_PATTERN = /<([^>]+)>/
const UPGRADE_STEP_PREFIX = /^<[^>]+>\s*-\s*/
// 서약 결정 칸은 slotNo 0~10이다.
const CRYSTAL_SLOTS = 11
// 진의 선택지 이름은 게임 원천(oathSystemScript [oath reinforce])에서 단계마다 세 개다.
// 1~4단계는 최종 데미지, 스킬 쿨타임 감소, 서약 포인트, 5~9단계는 모든 속도, 스킬 범위, 받는 피해 감소 순이다.
const UPGRADE_CHOICES: Readonly<Record<string, OathUpgradeChoice>> = {
  '강인한 통찰': 'finalDamage',
  '고요한 호흡': 'cooldown',
  '깨어난 서약': 'oathPoint',
  '포용의 권능': 'finalDamage',
  '자애의 마음': 'cooldown',
  '자비의 맹세': 'oathPoint',
  '심연의 고동': 'finalDamage',
  '내면의 조율': 'cooldown',
  '영혼의 계약': 'oathPoint',
  '신념의 대가': 'finalDamage',
  '경계의 인내': 'cooldown',
  '구원의 언약': 'oathPoint',
  '이어진 걸음': 'speed',
  '숭고한 동행': 'range',
  '결의의 공명': 'defense',
  '영원의 궤적': 'speed',
  '불변의 약속': 'range',
  '본질의 선언': 'defense',
  '만물의 흐름': 'speed',
  '바래온 구원': 'range',
  '자각의 파동': 'defense',
  '순례자의 길': 'speed',
  '맞잡은 구원': 'range',
  '남겨진 온기': 'defense',
  '진리 도달': 'speed',
  '완성된 의지': 'range',
  '만개하는 빛': 'defense'
}

export type OathCrystal = ItemView &
  Readonly<{ slot: number | null; tune: string | null; setPoint: number | null }>

export type OathSet = Readonly<{
  name: string | null
  optionName: string | null
  rarityName: string | null
  rarity: ItemRarity | null
  point: number | null
}>

export type OathUpgradeChoice =
  | 'finalDamage'
  | 'cooldown'
  | 'oathPoint'
  | 'speed'
  | 'range'
  | 'defense'

export type OathUpgradeStep = Readonly<{ name: string; choice: OathUpgradeChoice | null }>
export type OathUpgradeView = Readonly<{ title: string | null; steps: OathUpgradeStep[] }>

export type OathView = Readonly<{
  info: ItemView | null
  set: OathSet | null
  crystals: OathCrystal[]
  emptyCrystalSlots: number
  upgrade: OathUpgradeView | null
}>

function stepChoiceOf(upgrade: OathUpgrade | null, stepName: string): OathUpgradeChoice | null {
  const optionName = upgrade?.options.find((option) => option.stepName === stepName)?.optionName

  if (optionName == null) {
    return null
  }

  const choice = UPGRADE_CHOICES[optionName]

  if (choice === undefined) {
    return null
  }

  return choice
}

// 단계 이름은 "<묵언의 진의> - 첫 번째 진의" 모양이라, 꺾쇠 안 글자를 제목으로, 그 뒤를 단계 이름으로 쓴다.
function toUpgradeView(upgrade: OathUpgrade | null): OathUpgradeView {
  const libSteps = oathUpgradeSteps()
  const steps = libSteps.map(({ name }) => {
    const stepName = name.replace(UPGRADE_STEP_PREFIX, '')
    const choice = stepChoiceOf(upgrade, name)

    return { name: stepName, choice }
  })
  const title = libSteps[0]?.name.match(UPGRADE_TITLE_PATTERN)?.[1] ?? null

  return { title, steps }
}

function toInfoView(info: Oath['info']): OathView['info'] {
  if (info == null) {
    return null
  }

  return toItemView(info)
}

function toSetView(setInfo: Oath['setInfo']): OathSet | null {
  if (setInfo == null) {
    return null
  }

  const point = setInfo.active?.setPoint?.current ?? null

  return {
    name: setInfo.setName,
    optionName: setInfo.setOptionName,
    rarityName: setInfo.setRarityName,
    rarity: itemRarityOfGrade(setInfo.setRarityName),
    point
  }
}

function toCrystalView(crystal: Oath['crystal'][number]): OathCrystal {
  const slot = crystal.slotNo != null ? crystal.slotNo + 1 : null
  const setPoint = crystal.tune?.setPoint ?? null

  return {
    ...toItemView(crystal),
    slot,
    tune: tuneNumeral(crystal.tune?.level ?? null),
    setPoint
  }
}

function bySetPointThenSlot(a: OathCrystal, b: OathCrystal): number {
  const bPoint = b.setPoint ?? Number.NEGATIVE_INFINITY
  const aPoint = a.setPoint ?? Number.NEGATIVE_INFINITY
  if (aPoint !== bPoint) {
    return bPoint - aPoint
  }

  const aSlot = a.slot ?? Number.POSITIVE_INFINITY
  const bSlot = b.slot ?? Number.POSITIVE_INFINITY

  return aSlot - bSlot
}

export function toOathView(oath: Oath): OathView {
  const emptyCrystalSlots = Math.max(CRYSTAL_SLOTS - oath.crystal.length, 0)
  const upgrade = oath.info != null ? toUpgradeView(oath.info.oathUpgrade ?? null) : null

  return {
    info: toInfoView(oath.info),
    set: toSetView(oath.setInfo),
    crystals: oath.crystal.map(toCrystalView).sort(bySetPointThenSlot),
    emptyCrystalSlots,
    upgrade
  }
}
