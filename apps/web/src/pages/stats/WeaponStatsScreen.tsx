import { ListBox } from '#shared/ui/ListBox'
import { type SetStatsFilter, useItemStats } from '#entities/ranking'
import { StatsScreenFrame } from './StatsScreenFrame'
import { ItemRowBars } from './ItemRowBars'
import { FULL_SHARE, formatShare } from './set-stats-bars'
import { type WeaponType, weaponTypesOf } from './weapon-stats-bars'

const SKELETON_NAME = '무기'
const SKELETON_ROWS = 2
const EMPTY = '아이템 통계가 없습니다.'
const FAILED = '아이템 통계를 받지 못했습니다.'
const BOXES_PER_ROW = 2

function rowsOf(types: readonly WeaponType[]): WeaponType[][] {
  const rows: WeaponType[][] = []

  for (let index = 0; index < types.length; index += BOXES_PER_ROW) {
    rows.push(types.slice(index, index + BOXES_PER_ROW))
  }

  return rows
}

function WeaponSkeleton(): React.JSX.Element {
  const rows = Array.from({ length: SKELETON_ROWS }, (_, row) => row)
  const columns = Array.from({ length: BOXES_PER_ROW }, (_, column) => column)

  return (
    <>
      {rows.map((row) => (
        <div key={row} className="section section-cols">
          {columns.map((column) => (
            <ListBox key={column} name={SKELETON_NAME}>
              <span className="skeleton h-[160px]" />
            </ListBox>
          ))}
        </div>
      ))}
    </>
  )
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
      result={result}
      filter={filter}
      onFilterChange={onFilterChange}
      skeleton={<WeaponSkeleton />}
      messages={{ empty: EMPTY, failed: FAILED }}
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
                  barFromMd
                />
              </ListBox>
            ))}
          </div>
        ))
      }
    </StatsScreenFrame>
  )
}
