import { linkOptions } from '@tanstack/react-router'
import type { Bar } from '#shared/ui/chart/RowBars'
import type { RankingSearch } from '#widgets/ranking-filter'
import {
  equipmentSetShortName,
  oathSetShortName,
  SET_FAMILY_EQUIPMENT_SET_IDS,
  type SetStats,
  type SetStatsFilter
} from '#entities/ranking'

const COMBO_LIMIT = 10
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
