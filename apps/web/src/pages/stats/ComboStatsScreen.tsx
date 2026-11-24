import { RowBars } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import { type SetStatsFilter, useSetStats } from '#entities/ranking'
import { StatsScreenFrame } from './StatsScreenFrame'
import { equipmentComboBars } from './combo-stats-bars'
import { formatShare } from './set-stats-bars'

const BOX_NAME = '장비와 서약 조합'
const EMPTY = '세트 통계가 없습니다.'
const FAILED = '세트 통계를 받지 못했습니다.'
const SET_NAME_WIDTH = 200

export function ComboStatsScreen({
  filter,
  onFilterChange
}: {
  filter: SetStatsFilter
  onFilterChange: (filter: SetStatsFilter) => void
}): React.JSX.Element {
  const result = useSetStats(filter)

  return (
    <StatsScreenFrame
      result={result}
      filter={filter}
      onFilterChange={onFilterChange}
      skeleton={
        <ListBox name={BOX_NAME}>
          <span className="skeleton h-[480px]" />
        </ListBox>
      }
      messages={{ empty: EMPTY, failed: FAILED }}
    >
      {(stats) => (
        <ListBox name={BOX_NAME}>
          <RowBars
            barFromMd
            bars={equipmentComboBars(stats, filter)}
            tone="chart-3"
            formatValue={formatShare}
            nameWidth={SET_NAME_WIDTH}
          />
        </ListBox>
      )}
    </StatsScreenFrame>
  )
}
