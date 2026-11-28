import { linkOptions } from '@tanstack/react-router'
import type { Bar } from '#shared/ui/chart/RowBars'
import type { OathCatalog } from '#entities/catalog'
import type { RankingSearch } from '#widgets/ranking-filter'
import {
  equipmentSetShortName,
  OATH_OPTION_POSITIONS,
  oathSetShortName,
  sameFamilyOathShortName,
  SET_FAMILY_EQUIPMENT_SET_IDS,
  type SetStats,
  type SetStatsFilter
} from '#entities/ranking'

const COMBO_LIMIT = 10
const OATH_OPTION_NAME_SEPARATOR = ' : '
export const FULL_SHARE = 100

const percent = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

export function formatShare(share: number): string {
  return `${percent.format(share)}%`
}

export function shareOf(count: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return (count / total) * FULL_SHARE
}

export function rankingLink(filter: SetStatsFilter, narrowing: RankingSearch): Bar['link'] {
  return linkOptions({ to: '/rankings', search: { ...filter, ...narrowing } })
}

// 세트 없음은 비교 기준이라 비율과 관계없이 맨 아래에 둔다.
export function byCountWithBaseLast(a: Bar, b: Bar): number {
  if (a.base === b.base) {
    return b.value - a.value
  }

  if (a.base === true) {
    return 1
  }

  return -1
}

export type OathOptionShare = Readonly<{ position: string; name: string; share: number }>

export type SetColumn = Readonly<{
  key: string
  name: string
  value: number
  link?: Bar['link']
  options: readonly OathOptionShare[]
}>

function optionSharesOf(stats: SetStats, oathSet: OathCatalog['sets'][number]): OathOptionShare[] {
  const counted = stats.oathSets.find(({ setId }) => setId === oathSet.setId)
  const countOf = new Map(counted?.options.map((option) => [option.name, option.count]))

  return oathSet.options.flatMap(({ name }, index) => {
    const position = OATH_OPTION_POSITIONS[index]
    if (position === undefined) {
      return []
    }

    const share = shareOf(countOf.get(name) ?? 0, counted?.count ?? 0)
    const shortName = name.split(OATH_OPTION_NAME_SEPARATOR).at(-1) ?? name

    return [{ position, name: shortName, share }]
  })
}

function sameFamilyOathOf(
  catalog: OathCatalog | null,
  equipmentShortName: string
): OathCatalog['sets'][number] | undefined {
  const oathShortName = sameFamilyOathShortName(equipmentShortName)

  return catalog?.sets.find(({ name }) => oathSetShortName(name) === oathShortName)
}

// 같은 계열 서약이 있는 장비 세트만, 아무도 끼지 않았어도 0%로 모두 보인다.
export function equipmentSetColumns(
  stats: SetStats,
  catalog: OathCatalog | null,
  filter: SetStatsFilter
): SetColumn[] {
  return SET_FAMILY_EQUIPMENT_SET_IDS.map((setId): SetColumn => {
    const counted = stats.equipmentSets.find((set) => set.setId === setId)
    const value = shareOf(counted?.count ?? 0, stats.sampleSize)
    const shortName = equipmentSetShortName(setId, null)
    const link = rankingLink(filter, { equipmentSetId: setId })
    const oathSet = sameFamilyOathOf(catalog, shortName)
    const options = oathSet !== undefined ? optionSharesOf(stats, oathSet) : []

    return { key: setId, name: shortName, value, link, options }
  }).toSorted((a, b) => b.value - a.value)
}

// 조합의 서약 세트가 서약 세트 목록에 없으면 이름을 알 수 없어 번호를 그대로 보인다.
export function comboBars(stats: SetStats, filter: SetStatsFilter): Bar[] {
  const oathNames = new Map(
    stats.oathSets.map(({ setId, name }) => [setId, oathSetShortName(name)])
  )

  return stats.combos
    .flatMap(({ equipmentSetId, oathSetId, count }): Bar[] => {
      if (
        equipmentSetId === null ||
        oathSetId === null ||
        !SET_FAMILY_EQUIPMENT_SET_IDS.includes(equipmentSetId)
      ) {
        return []
      }

      const equipmentName = equipmentSetShortName(equipmentSetId, null)
      const oathName = oathNames.get(oathSetId) ?? String(oathSetId)
      const value = shareOf(count, stats.sampleSize)
      const link = rankingLink(filter, { equipmentSetId, oathSetId })
      const key = `${equipmentSetId}/${oathSetId}`
      const name = `${equipmentName} + ${oathName}`

      return [{ key, name, value, link }]
    })
    .toSorted((a, b) => b.value - a.value)
    .slice(0, COMBO_LIMIT)
}
