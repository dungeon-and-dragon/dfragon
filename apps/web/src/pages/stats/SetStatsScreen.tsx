import { RowBars } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import { useOathCatalog } from '#entities/catalog'
import { type SetStatsFilter, useSetStats } from '#entities/ranking'
import { ItemStatsBoxes } from './ItemStatsBoxes'
import { StatsNote } from './StatsNote'
import { SetStatsFilterBox } from './SetStatsFilterBox'
import { StatsTabs } from '#widgets/stats-tabs'
import { SetColumns } from './SetColumns'
import { comboBars, equipmentSetColumns, formatShare } from './set-stats-bars'

const EMPTY = '세트 통계가 없습니다.'
const FAILED = '세트 통계를 받지 못했습니다.'
const BOX_NAMES = {
  equipment: '장비 세트',
  combo: '장비와 서약 조합'
} as const

export function SetStatsScreen({
  filter,
  onFilterChange
}: {
  filter: SetStatsFilter
  onFilterChange: (filter: SetStatsFilter) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <StatsTabs />
      <SetStatsBody filter={filter} onFilterChange={onFilterChange} />
    </div>
  )
}

function SetStatsBody({
  filter,
  onFilterChange
}: {
  filter: SetStatsFilter
  onFilterChange: (filter: SetStatsFilter) => void
}): React.JSX.Element {
  const result = useSetStats(filter)
  const catalog = useOathCatalog()

  const filterBox = <SetStatsFilterBox filter={filter} onFilterChange={onFilterChange} />

  if (result.status === 'error') {
    return (
      <>
        {filterBox}
        <p role="alert" className="section state state-error">
          {FAILED}
        </p>
      </>
    )
  }

  // 서약 카탈로그가 없거나 받지 못해도 선택지 원래 이름으로 보이므로 통계와 카탈로그를 함께 기다리기만 한다.
  if (result.status === 'loading' || catalog.status === 'loading') {
    return (
      <div aria-busy="true">
        {filterBox}
        <div aria-hidden="true">
          <div className="section section-cols">
            {Object.values(BOX_NAMES).map((name) => (
              <ListBox key={name} name={name}>
                <span className="skeleton h-[224px]" />
              </ListBox>
            ))}
          </div>
        </div>
        <ItemStatsBoxes filter={filter} />
      </div>
    )
  }

  const stats = result.value
  const oathCatalog = catalog.status === 'success' ? catalog.value : null
  const empty = stats.computedAt === null || stats.sampleSize === 0

  return (
    <>
      {filterBox}
      {stats.computedAt !== null && (
        <StatsNote count={stats.sampleSize} computedAt={stats.computedAt} />
      )}
      <div className="section section-cols">
        <ListBox name={BOX_NAMES.equipment} fillHeight>
          {empty ? (
            <p className="state">{EMPTY}</p>
          ) : (
            <SetColumns columns={equipmentSetColumns(stats, oathCatalog, filter)} />
          )}
        </ListBox>
        <ListBox name={BOX_NAMES.combo}>
          {empty ? (
            <p className="state">{EMPTY}</p>
          ) : (
            <RowBars
              barFromMd
              bars={comboBars(stats, filter)}
              tone="chart-3"
              formatValue={formatShare}
            />
          )}
        </ListBox>
      </div>
      <ItemStatsBoxes filter={filter} />
    </>
  )
}
