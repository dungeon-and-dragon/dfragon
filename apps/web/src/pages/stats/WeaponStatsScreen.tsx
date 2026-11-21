import { ListBox } from '#shared/ui/ListBox'
import { type SetStatsFilter, useItemStats } from '#entities/ranking'
import { StatsScreenFrame } from './StatsScreenFrame'
import { ItemRowBars } from './ItemRowBars'
import { FULL_SHARE, formatShare } from './set-stats-bars'
import { type WeaponType, weaponTypesOf } from './weapon-stats-bars'

const TITLE = '무기 통계'
const SKELETON_NAME = '무기'
const EMPTY = '아이템 통계가 없습니다.'
const FAILED = '아이템 통계를 받지 못했습니다.'
const LOADING = '아이템 통계를 받는 중입니다.'
const BOXES_PER_ROW = 2

function rowsOf(types: readonly WeaponType[]): WeaponType[][] {
  const rows: WeaponType[][] = []

  for (let index = 0; index < types.length; index += BOXES_PER_ROW) {
    rows.push(types.slice(index, index + BOXES_PER_ROW))
  }

  return rows
}

export function WeaponStatsScreen({
  filter,
  onFilterChange
}: {
  filter: SetStatsFilter
  onFilterChange: (filter: SetStatsFilter) => void
}): React.JSX.Element {
  const result = useItemStats(filter)

  return (
    <StatsScreenFrame
      title={TITLE}
      result={result}
      filter={filter}
      onFilterChange={onFilterChange}
      skeletonName={SKELETON_NAME}
      messages={{ empty: EMPTY, failed: FAILED, loading: LOADING }}
    >
      {(stats) =>
        rowsOf(weaponTypesOf(stats, filter)).map((row) => (
          <div key={row.map(({ name }) => name).join()} className="section section-cols">
            {row.map((type) => (
              <ListBox key={type.name} name={`${type.name} ${formatShare(type.share)}`}>
                <ItemRowBars
                  bars={type.weapons}
                  tone="chart-2"
                  max={FULL_SHARE}
                  formatValue={formatShare}
                />
              </ListBox>
            ))}
          </div>
        ))
      }
    </StatsScreenFrame>
  )
}
