import type { OathCatalog } from '#entities/catalog'
import {
  catalogOptionNamesOf,
  equipmentSetShortName,
  type FameRankingSetFilter,
  oathOptionShortName,
  oathSetShortName,
  type RankedCharacter,
  type SetStats
} from '#entities/ranking'

export type SetChoice = Readonly<{ value: string; label: string }>

export type SetChoices = Readonly<{
  equipment: readonly SetChoice[]
  oath: readonly SetChoice[]
  options: readonly SetChoice[]
}>

// 랭킹 세트 검색에서 고를 일이 없는 장비 세트다. 오디세이 고급 세트, 차원 속의 이야기 세트.
const HIDDEN_EQUIPMENT_SET_IDS: ReadonlySet<string> = new Set([
  '13f6edd6dc195fdb8bc76b8349078ef6',
  'b9403caf99c157682d1d468d899e9aaa'
])

function byCountDesc<Item extends { count: number }>(a: Item, b: Item): number {
  return b.count - a.count
}

// 세트 통계를 받기 전이거나 목록에 없는 세트가 주소에 있어도 셀렉트가 고른 값을 보이도록 그 값을 앞에 더한다.
function withChosen(
  choices: readonly SetChoice[],
  value: string | undefined,
  label: string
): SetChoice[] {
  if (value === undefined || choices.some((choice) => choice.value === value)) {
    return [...choices]
  }

  return [{ value, label }, ...choices]
}

function oathNameOf(
  stats: SetStats | null,
  catalog: OathCatalog | null,
  setId: number
): string | null {
  const catalogSet = catalog?.sets.find((set) => set.setId === setId)
  if (catalogSet !== undefined) {
    return catalogSet.name
  }

  const counted = stats?.oathSets.find((set) => set.setId === setId)
  if (counted === undefined) {
    return null
  }

  return counted.name
}

function equipmentLabelOf(stats: SetStats | null, setId: string): string {
  const counted = stats?.equipmentSets.find((set) => set.setId === setId)
  const name = counted !== undefined ? counted.name : null

  return equipmentSetShortName(setId, name)
}

function oathLabelOf(stats: SetStats | null, catalog: OathCatalog | null, setId: number): string {
  const name = oathNameOf(stats, catalog, setId)
  if (name === null) {
    return String(setId)
  }

  return oathSetShortName(name)
}

function optionLabelOf(
  stats: SetStats | null,
  catalog: OathCatalog | null,
  setId: number,
  option: string
): string {
  const name = oathNameOf(stats, catalog, setId)
  const catalogNames = catalogOptionNamesOf(catalog, setId)

  return oathOptionShortName(name, option, catalogNames)
}

function optionChoicesOf(
  stats: SetStats | null,
  catalog: OathCatalog | null,
  setId: number
): SetChoice[] {
  const catalogNames = catalogOptionNamesOf(catalog, setId)
  const counted = stats?.oathSets.find((set) => set.setId === setId)
  const countedNames = (counted?.options ?? []).flatMap(({ name }) => {
    if (name === null || catalogNames.includes(name)) {
      return []
    }

    return [name]
  })

  return [...catalogNames, ...countedNames].map((option) => {
    const label = optionLabelOf(stats, catalog, setId, option)

    return { value: option, label }
  })
}

export function setChoicesOf(
  stats: SetStats | null,
  catalog: OathCatalog | null,
  filter: FameRankingSetFilter
): SetChoices {
  const equipment = (stats?.equipmentSets ?? [])
    .toSorted(byCountDesc)
    .flatMap(({ setId, name }) => {
      if (setId === null || HIDDEN_EQUIPMENT_SET_IDS.has(setId)) {
        return []
      }

      const label = equipmentSetShortName(setId, name)

      return [{ value: setId, label }]
    })
  const oath = (stats?.oathSets ?? []).toSorted(byCountDesc).flatMap(({ setId }) => {
    if (setId === null) {
      return []
    }

    const label = oathLabelOf(stats, catalog, setId)

    return [{ value: String(setId), label }]
  })
  const { equipmentSetId, oathSetId, oathSetOption } = filter
  const chosenEquipment =
    equipmentSetId !== undefined ? equipmentLabelOf(stats, equipmentSetId) : ''
  const chosenOath = oathSetId !== undefined ? oathLabelOf(stats, catalog, oathSetId) : ''
  const oathValue = oathSetId !== undefined ? String(oathSetId) : undefined
  const equipmentChoices = withChosen(equipment, equipmentSetId, chosenEquipment)
  const oathChoices = withChosen(oath, oathValue, chosenOath)
  if (oathSetId === undefined) {
    return { equipment: equipmentChoices, oath: oathChoices, options: [] }
  }

  const options = optionChoicesOf(stats, catalog, oathSetId)
  const chosenOption =
    oathSetOption !== undefined ? optionLabelOf(stats, catalog, oathSetId, oathSetOption) : ''
  const optionChoices = withChosen(options, oathSetOption, chosenOption)

  return { equipment: equipmentChoices, oath: oathChoices, options: optionChoices }
}

export function setFilterLabel(
  stats: SetStats | null,
  catalog: OathCatalog | null,
  { equipmentSetId, oathSetId, oathSetOption }: FameRankingSetFilter
): string | null {
  const labels: string[] = []
  if (equipmentSetId !== undefined) {
    labels.push(equipmentLabelOf(stats, equipmentSetId))
  }

  if (oathSetId !== undefined && oathSetOption !== undefined) {
    labels.push(optionLabelOf(stats, catalog, oathSetId, oathSetOption))
  } else if (oathSetId !== undefined) {
    labels.push(oathLabelOf(stats, catalog, oathSetId))
  }

  if (labels.length === 0) {
    return null
  }

  return labels.join(' ')
}

export type RankingSetLines = Readonly<{ equipment: string | null; oath: string | null }>

export function rankingSetLines(
  { equipmentSet, oathSet }: Pick<RankedCharacter, 'equipmentSet' | 'oathSet'>,
  catalog: OathCatalog | null
): RankingSetLines {
  const equipment =
    equipmentSet !== null ? equipmentSetShortName(equipmentSet.id, equipmentSet.name) : null
  if (oathSet === null) {
    return { equipment, oath: null }
  }

  if (oathSet.option === null) {
    const oath = oathSetShortName(oathSet.name)

    return { equipment, oath }
  }

  const catalogNames = catalogOptionNamesOf(catalog, oathSet.id)
  const oath = oathOptionShortName(oathSet.name, oathSet.option, catalogNames)

  return { equipment, oath }
}
