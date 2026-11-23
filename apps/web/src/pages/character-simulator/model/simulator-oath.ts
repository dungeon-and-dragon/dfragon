import {
  findOathCrystal,
  findOathCrystalVariant,
  findOathVariant,
  moveOathCrystalToSet,
  type OathCrystalVariant,
  type OathSet,
  type OathVariant,
  oathCrystalVariantsOf,
  oathSets,
  oathVariantOf,
  oathVariantsOf,
  PRIMEVAL_OATH_CRYSTAL_LIMIT
} from '@dfragon/lib/equipment-variants'
import {
  type CharacterDetailView,
  type ItemView,
  itemRarityOfGrade,
  toItemView
} from '#entities/character'

type Oath = NonNullable<CharacterDetailView['oath']>
type OathCrystalItem = Oath['crystal'][number]

/** grade는 lib의 등급 이름이다. maxTune이 0이면 조율할 수 없는 결정이고, 서약 본체는 늘 0이다. */
export type OathChoice = Readonly<{
  id: string
  itemId: string
  name: string
  rarity: ItemView['rarity']
  grade: string
  maxTune: number
}>

/**
 * wornVariantId는 지금 기준의 본체 선택지 id다. 서약 세트를 바꾸면 그 세트의 같은 등급이 되고, null이면 선택지에 없는 본체다.
 * setBound가 false면 세트에 속하지 않는 본체라 서약 세트를 바꿔도 그대로다.
 */
export type SimulatorOathBody = ItemView &
  Readonly<{ choices: readonly OathChoice[]; wornVariantId: string | null; setBound: boolean }>

/**
 * wornVariantId, wornTune은 지금 기준의 결정과 조율이다. 서약 세트를 바꾸면 광휘 결정은 그 세트의 같은 등급이 된다.
 * wornVariantId가 null이면 광휘 결정이 아닌 착용 결정이고, 그때 조율 상한은 wornMaxTune이다.
 */
export type SimulatorOathCrystal = ItemView &
  Readonly<{
    slotNo: number
    choices: readonly OathChoice[]
    wornVariantId: string | null
    wornTune: number
    wornMaxTune: number
  }>

/** setId가 null이면 선택 목록에 없는 서약 세트라 세트를 고르지 않는다. */
export type SimulatorOath = Readonly<{
  setId: number | null
  sets: readonly OathSet[]
  body: SimulatorOathBody | null
  crystals: readonly SimulatorOathCrystal[]
}>

export type CrystalDraft = Readonly<{ variantId: string | null; tune: number }>

/** 고른 서약 세트, 고른 본체 선택지 id와 slotNo별로 바꾼 결정만 담는다. */
export type OathChanges = Readonly<{
  set: number | null
  body: string | null
  crystals: Readonly<Record<number, CrystalDraft>>
}>

export const NO_OATH_CHANGES: OathChanges = { set: null, body: null, crystals: {} }

const PRIMEVAL: ItemView['rarity'] = 'primordial'

/** `variantId`, `tune`이 null이면 착용 결정의 값을 그대로 둔다. */
export type OathCrystalChange = Readonly<{
  slotNo: number
  tune: number | null
  variantId: string | null
}>

function maxTuneOf(tuneSetPoints: readonly number[]): number {
  return Math.max(0, tuneSetPoints.length - 1)
}

function toOathChoice(variant: OathVariant | OathCrystalVariant): OathChoice {
  const { itemId, itemName, itemRarity } = variant.item
  const maxTune = 'tuneSetPoints' in variant ? maxTuneOf(variant.tuneSetPoints) : 0

  return {
    id: variant.id,
    itemId,
    name: itemName,
    rarity: itemRarityOfGrade(itemRarity),
    grade: variant.rarity,
    maxTune
  }
}

function toOathBody(info: Oath['info']): SimulatorOathBody | null {
  if (info?.itemId == null) {
    return null
  }

  const match = findOathVariant(info.itemId)
  const itemView = toItemView(info)

  if (match === null) {
    return { ...itemView, choices: [], wornVariantId: null, setBound: false }
  }

  const choices = oathVariantsOf(match.setId).map(toOathChoice)
  const setBound = match.setId !== null

  return { ...itemView, choices, wornVariantId: match.variant.id, setBound }
}

function toOathCrystal(crystal: OathCrystalItem, wornSetId: number | null): SimulatorOathCrystal[] {
  if (crystal.slotNo === null) {
    return []
  }

  const match = crystal.itemId !== null ? findOathCrystalVariant(crystal.itemId) : null
  const choiceSetId = match?.setId ?? wornSetId
  const choices = choiceSetId !== null ? oathCrystalVariantsOf(choiceSetId).map(toOathChoice) : []
  const known = crystal.itemName !== null ? findOathCrystal(crystal.itemName) : null
  const wornMaxTune = known !== null ? maxTuneOf(known.tuneSetPoints) : 0
  const wornVariantId = match?.variant.id ?? null
  const wornTune = crystal.tune?.level ?? 0
  const itemView = toItemView(crystal)

  return [{ ...itemView, slotNo: crystal.slotNo, choices, wornVariantId, wornTune, wornMaxTune }]
}

function listedSetId(setId: number | null | undefined): number | null {
  const listed = oathSets().find((oathSet) => oathSet.setId === setId)

  if (listed === undefined) {
    return null
  }

  return listed.setId
}

/** 서약이 없으면 null이다. 결정은 slotNo 순서로 둔다. */
export function toSimulatorOath(detail: Pick<CharacterDetailView, 'oath'>): SimulatorOath | null {
  const { oath } = detail

  if (oath === null) {
    return null
  }

  const setId = listedSetId(oath.setInfo?.setId)
  const crystals = oath.crystal
    .flatMap((crystal) => toOathCrystal(crystal, setId))
    .toSorted((a, b) => a.slotNo - b.slotNo)
  const sets = oathSets()
  const body = toOathBody(oath.info)

  return { setId, sets, body, crystals }
}

function choiceOf(choices: readonly OathChoice[], id: string | null): OathChoice | undefined {
  return choices.find((choice) => choice.id === id)
}

function bodyInSet(body: SimulatorOathBody, setId: number): SimulatorOathBody {
  if (!body.setBound) {
    return body
  }

  const worn = choiceOf(body.choices, body.wornVariantId)
  const moved = worn !== undefined ? oathVariantOf(setId, worn.grade) : null
  const choices = oathVariantsOf(setId).map(toOathChoice)
  const wornVariantId = moved?.id ?? null

  return { ...body, choices, wornVariantId }
}

function crystalInSet(crystal: SimulatorOathCrystal, setId: number): SimulatorOathCrystal {
  const choices = oathCrystalVariantsOf(setId).map(toOathChoice)

  if (crystal.wornVariantId === null) {
    return { ...crystal, choices }
  }

  const moved = moveOathCrystalToSet(crystal.wornVariantId, setId)
  const wornVariantId = moved?.id ?? null
  const limit = choiceOf(choices, wornVariantId)?.maxTune ?? crystal.wornMaxTune
  const wornTune = Math.min(crystal.wornTune, limit)

  return { ...crystal, choices, wornVariantId, wornTune }
}

/** 고른 서약 세트로 옮긴 서약이다. 세트를 고르지 않았으면 그대로다. 영겁의 안개 서약과 광휘 결정이 아닌 결정은 그대로 둔다. */
export function oathInSet(oath: SimulatorOath, setId: number | null): SimulatorOath {
  if (setId === null) {
    return oath
  }

  const body = oath.body !== null ? bodyInSet(oath.body, setId) : null
  const crystals = oath.crystals.map((crystal) => crystalInSet(crystal, setId))

  return { ...oath, setId, body, crystals }
}

export function oathSetNameOf(oath: SimulatorOath): string | null {
  const current = oath.sets.find((oathSet) => oathSet.setId === oath.setId)

  if (current === undefined) {
    return null
  }

  return current.name
}

export function oathBodyChoiceIdOf(body: SimulatorOathBody, changes: OathChanges): string | null {
  if (changes.body === null) {
    return body.wornVariantId
  }

  return changes.body
}

function choiceItem(choice: OathChoice): ItemView {
  return { itemId: choice.itemId, itemName: choice.name, rarity: choice.rarity }
}

/** 장비창에 보일 본체다. 고른 선택지나 세트를 옮긴 본체이고, 선택지에 없는 본체는 착용 본체다. */
export function oathBodyItemOf(body: SimulatorOathBody, changes: OathChanges): ItemView {
  const choice = choiceOf(body.choices, oathBodyChoiceIdOf(body, changes))

  if (choice === undefined) {
    return body
  }

  return choiceItem(choice)
}

export function crystalDraftOf(crystal: SimulatorOathCrystal, changes: OathChanges): CrystalDraft {
  const changed = changes.crystals[crystal.slotNo]

  if (changed === undefined) {
    return { variantId: crystal.wornVariantId, tune: crystal.wornTune }
  }

  return changed
}

export function crystalChoiceOf(
  crystal: SimulatorOathCrystal,
  variantId: string | null
): OathChoice | undefined {
  return choiceOf(crystal.choices, variantId)
}

/** 결정의 조율 상한이다. 0이면 조율할 수 없다. */
export function crystalTuneLimitOf(
  crystal: SimulatorOathCrystal,
  variantId: string | null
): number {
  const choice = crystalChoiceOf(crystal, variantId)

  if (choice === undefined) {
    return crystal.wornMaxTune
  }

  return choice.maxTune
}

/** 장비창에 보일 결정이다. 고른 결정이나 세트를 옮긴 결정이고, 광휘 결정이 아닌 착용 결정은 그대로다. */
export function crystalItemOf(crystal: SimulatorOathCrystal, changes: OathChanges): ItemView {
  const choice = crystalChoiceOf(crystal, crystalDraftOf(crystal, changes).variantId)

  if (choice === undefined) {
    return crystal
  }

  return choiceItem(choice)
}

function isInRange(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max
}

/**
 * 결정을 고를 수 있는 선택지다. 다른 결정의 태초가 이미 상한이면 태초 선택지를 빼고, 지금 고른 태초는 남겨 그대로 보이게 한다.
 * oath는 지금 기준으로 옮긴 서약이다.
 */
export function crystalChoicesOf(
  oath: SimulatorOath,
  crystal: SimulatorOathCrystal,
  changes: OathChanges
): readonly OathChoice[] {
  const primevalOthers = oath.crystals.filter(
    (other) => other.slotNo !== crystal.slotNo && crystalItemOf(other, changes).rarity === PRIMEVAL
  ).length

  if (primevalOthers < PRIMEVAL_OATH_CRYSTAL_LIMIT) {
    return crystal.choices
  }

  const { variantId } = crystalDraftOf(crystal, changes)

  return crystal.choices.filter((choice) => choice.rarity !== PRIMEVAL || choice.id === variantId)
}

/** 결정을 바꾸면 조율은 새 결정의 최대 단계까지 유지한다. 태초 결정이 상한을 넘게 되는 변경은 받지 않는다. */
export function changeCrystal(
  changes: OathChanges,
  oath: SimulatorOath,
  crystal: SimulatorOathCrystal,
  draft: Partial<CrystalDraft>
): OathChanges {
  const current = crystalDraftOf(crystal, changes)
  const variantId = draft.variantId !== undefined ? draft.variantId : current.variantId
  const limit = crystalTuneLimitOf(crystal, variantId)
  const tune = draft.tune !== undefined ? draft.tune : Math.min(current.tune, limit)
  const choosable =
    variantId === crystal.wornVariantId ||
    crystalChoicesOf(oath, crystal, changes).some((choice) => choice.id === variantId)

  if (!choosable || !isInRange(tune, limit)) {
    return changes
  }

  const { [crystal.slotNo]: _previous, ...others } = changes.crystals

  if (variantId === crystal.wornVariantId && tune === crystal.wornTune) {
    return { ...changes, crystals: others }
  }

  return { ...changes, crystals: { ...others, [crystal.slotNo]: { variantId, tune } } }
}

export function changeOathBody(
  changes: OathChanges,
  body: SimulatorOathBody,
  id: string
): OathChanges {
  if (id === body.wornVariantId) {
    return { ...changes, body: null }
  }

  if (choiceOf(body.choices, id) === undefined) {
    return changes
  }

  return { ...changes, body: id }
}

/**
 * 서약 세트를 바꾸면 고른 본체는 지우고, 결정은 새 세트의 기준 결정으로 되돌리되 바꾼 조율은 새 결정의 최대 단계까지 유지한다.
 * 착용한 세트를 다시 고르면 세트를 고르지 않은 것으로 둔다.
 */
export function changeOathSet(
  changes: OathChanges,
  oath: SimulatorOath,
  setId: number
): OathChanges {
  if (!oath.sets.some((oathSet) => oathSet.setId === setId)) {
    return changes
  }

  const set = setId === oath.setId ? null : setId
  const view = oathInSet(oath, set)
  const crystals = Object.fromEntries(
    view.crystals.flatMap((crystal): [number, CrystalDraft][] => {
      const changed = changes.crystals[crystal.slotNo]

      if (changed === undefined) {
        return []
      }

      const limit = crystalTuneLimitOf(crystal, crystal.wornVariantId)
      const tune = Math.min(changed.tune, limit)

      if (tune === crystal.wornTune) {
        return []
      }

      return [[crystal.slotNo, { variantId: crystal.wornVariantId, tune }]]
    })
  )

  return { set, body: null, crystals }
}

/** 바꾼 결정만 slotNo 순서로 넣는다. 결정을 바꾸지 않았고 조율이 착용한 단계면 그 칸을 null로 둔다. */
export function oathCrystalChanges(
  oath: SimulatorOath | null,
  changes: OathChanges
): OathCrystalChange[] {
  if (oath === null) {
    return []
  }

  return oath.crystals.flatMap((crystal) => {
    const changed = changes.crystals[crystal.slotNo]

    if (changed === undefined) {
      return []
    }

    const variantId = changed.variantId === crystal.wornVariantId ? null : changed.variantId
    const tune = variantId === null && changed.tune === crystal.wornTune ? null : changed.tune

    return [{ slotNo: crystal.slotNo, tune, variantId }]
  })
}

export function hasOathChanges(changes: OathChanges): boolean {
  return changes.set !== null || changes.body !== null || Object.keys(changes.crystals).length > 0
}
