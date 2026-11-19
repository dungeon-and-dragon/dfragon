import { linkOptions } from '@tanstack/react-router'
import type { Bar } from '#shared/ui/chart/RowBars'
import type { OathCatalog } from '#core/catalog'
import type { RankingSearch } from '#pages/rankings'
import {
  catalogOptionNamesOf,
  equipmentSetShortName,
  NO_SET_NAME,
  oathOptionShortName,
  oathSetShortName,
  type OathSetCount,
  type SetStats,
  type SetStatsFilter
} from '#core/ranking'

const NO_OPTION_NAME = '선택지 없음'
const COMBO_LIMIT = 10
const FULL_SHARE = 100

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
function byCountWithBaseLast(a: Bar, b: Bar): number {
  if (a.base === b.base) {
    return b.value - a.value
  }

  if (a.base === true) {
    return 1
  }

  return -1
}

export function equipmentSetBars(stats: SetStats, filter: SetStatsFilter): Bar[] {
  return stats.equipmentSets
    .map(({ setId, name, count }): Bar => {
      const value = shareOf(count, stats.sampleSize)
      if (setId === null) {
        return { key: NO_SET_NAME, name: NO_SET_NAME, value, base: true }
      }

      const shortName = equipmentSetShortName(setId, name)
      const link = rankingLink(filter, { equipmentSetId: setId })

      return { key: setId, name: shortName, value, link }
    })
    .toSorted(byCountWithBaseLast)
}

function optionBars(
  { setId, name, count, options }: OathSetCount & { setId: number },
  catalog: OathCatalog | null,
  filter: SetStatsFilter
): Bar[] {
  const catalogNames = catalogOptionNamesOf(catalog, setId)
  const countOf = new Map(options.map((option) => [option.name, option.count]))
  const unknownNames = options.flatMap((option) => {
    if (option.name === null || catalogNames.includes(option.name)) {
      return []
    }

    return [option.name]
  })
  const named = [...catalogNames, ...unknownNames].map((optionName) => {
    const shortName = oathOptionShortName(name, optionName, catalogNames)
    const value = shareOf(countOf.get(optionName) ?? 0, count)
    const link = rankingLink(filter, { oathSetId: setId, oathSetOption: optionName })

    return { key: `${setId}/${optionName}`, name: shortName, value, link }
  })
  const unnamedCount = countOf.get(null)
  if (unnamedCount === undefined) {
    return named
  }

  const unnamedValue = shareOf(unnamedCount, count)

  return [...named, { key: `${setId}/`, name: NO_OPTION_NAME, value: unnamedValue, base: true }]
}

export function oathSetBars(
  stats: SetStats,
  catalog: OathCatalog | null,
  filter: SetStatsFilter
): Bar[] {
  return stats.oathSets
    .map((oathSet): Bar => {
      const { setId, name, count } = oathSet
      const value = shareOf(count, stats.sampleSize)
      if (setId === null) {
        return { key: NO_SET_NAME, name: NO_SET_NAME, value, base: true }
      }

      const key = String(setId)
      const shortName = oathSetShortName(name)
      const link = rankingLink(filter, { oathSetId: setId })
      const detailBars = optionBars({ ...oathSet, setId }, catalog, filter)

      return {
        key,
        name: shortName,
        value,
        link,
        details: { bars: detailBars, max: FULL_SHARE }
      }
    })
    .toSorted(byCountWithBaseLast)
}

// 조합의 서약 세트가 서약 세트 목록에 없으면 이름을 알 수 없어 번호를 그대로 보인다.
function unlistedOathSetName(oathSetId: number | null): string {
  if (oathSetId === null) {
    return NO_SET_NAME
  }

  return String(oathSetId)
}

export function comboBars(stats: SetStats, filter: SetStatsFilter): Bar[] {
  const equipmentNames = new Map(
    stats.equipmentSets.map(({ setId, name }) => [setId, equipmentSetShortName(setId, name)])
  )
  const oathNames = new Map(
    stats.oathSets.map(({ setId, name }) => [setId, oathSetShortName(name)])
  )
  const bars = stats.combos.map(({ equipmentSetId, oathSetId, count }): Bar => {
    const equipmentName =
      equipmentNames.get(equipmentSetId) ?? equipmentSetShortName(equipmentSetId, null)
    const oathName = oathNames.get(oathSetId) ?? unlistedOathSetName(oathSetId)
    const value = shareOf(count, stats.sampleSize)
    const key = `${equipmentSetId ?? ''}/${oathSetId ?? ''}`
    if (equipmentSetId === null && oathSetId === null) {
      return { key, name: NO_SET_NAME, value, base: true }
    }

    const name = `${equipmentName} + ${oathName}`
    // 랭킹은 세트 없음으로 거르지 못하므로 한쪽이 없는 조합은 랭킹으로 잇지 않는다.
    if (equipmentSetId === null || oathSetId === null) {
      return { key, name, value }
    }

    const link = rankingLink(filter, { equipmentSetId, oathSetId })

    return { key, name, value, link }
  })
  const sorted = bars.toSorted(byCountWithBaseLast)

  return [
    ...sorted.filter(({ base }) => base !== true).slice(0, COMBO_LIMIT),
    ...sorted.filter(({ base }) => base === true)
  ]
}
