import type { CharacterDetailView } from '../shared/search/character-detail-view'
import {
  type ItemRarity,
  type ItemView,
  itemRarity,
  type StatLine,
  toItemView,
  toStatLines,
  tuneNumeral
} from './character-item'

type Oath = NonNullable<CharacterDetailView['oath']>
type OathUpgrade = NonNullable<NonNullable<Oath['info']>['oathUpgrade']>

const UPGRADE_TITLE_PATTERN = /<([^>]+)>/

export type OathCrystal = ItemView &
  Readonly<{ slot: number | null; tune: string | null; setPoint: number | null }>

export type OathSet = Readonly<{
  name: string | null
  optionName: string | null
  rarityName: string | null
  rarity: ItemRarity | null
  point: number | null
}>

export type OathUpgradeView = Readonly<{ title: string | null; lines: StatLine[] }>

export type OathView = Readonly<{
  info: (ItemView & Readonly<{ setPoint: number | null }>) | null
  set: OathSet | null
  crystals: OathCrystal[]
  setStatus: StatLine[]
  blessing: StatLine[]
  upgrade: OathUpgradeView | null
}>

// 묶음의 화면 이름이 정해지지 않아, "<묵언의 진의> - 첫 번째 진의"처럼 단계 이름의 꺾쇠 안 글자를 제목으로 쓴다.
function upgradeTitle(upgrade: OathUpgrade): string | null {
  for (const { stepName } of upgrade.options) {
    const title = stepName?.match(UPGRADE_TITLE_PATTERN)?.[1]

    if (title !== undefined) {
      return title
    }
  }

  return null
}

function toUpgradeView(upgrade: OathUpgrade | null): OathUpgradeView | null {
  if (upgrade == null) {
    return null
  }

  const steps = upgrade.options.flatMap(({ stepName, optionName }) =>
    stepName != null && optionName != null ? [{ name: stepName, value: optionName }] : []
  )
  const lines = [...steps, ...toStatLines(upgrade.status)]

  if (lines.length === 0) {
    return null
  }

  return { title: upgradeTitle(upgrade), lines }
}

function toInfoView(info: Oath['info']): OathView['info'] {
  if (info == null) {
    return null
  }

  return { ...toItemView(info), setPoint: info.setPoint }
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
    rarity: itemRarity(setInfo.setRarityName),
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

export function toOathView(oath: Oath): OathView {
  return {
    info: toInfoView(oath.info),
    set: toSetView(oath.setInfo),
    crystals: oath.crystal.map(toCrystalView),
    setStatus: toStatLines(oath.setInfo?.active?.status ?? []),
    blessing: toStatLines(oath.blessing?.status ?? []),
    upgrade: toUpgradeView(oath.info?.oathUpgrade ?? null)
  }
}
