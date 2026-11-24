import { type Bar, type BarTone, RowBars } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import { type OathCatalog, useOathCatalog } from '#entities/catalog'
import { type SetStats, type SetStatsFilter, useSetStats } from '#entities/ranking'
import { ItemStatsBoxes } from './ItemStatsBoxes'
import { StatsNote } from './StatsNote'
import { SetStatsFilterBox } from './SetStatsFilterBox'
import { StatsTabs } from '#widgets/stats-tabs'
import { comboBars, equipmentSetBars, formatShare, oathSetBars } from './set-stats-bars'

const EMPTY = '세트 통계가 없습니다.'
const FAILED = '세트 통계를 받지 못했습니다.'
const BOX_NAMES = {
  equipment: '장비 세트',
  oath: '서약 세트',
  combo: '장비와 서약 조합'
} as const
// 장비와 서약 상자는 반 폭이라 줄임말이 없는 긴 세트 이름도 들어가게, 조합은 한 줄 폭이라 넓게 둔다.
const SET_NAME_WIDTH = 200
const COMBO_NAME_WIDTH = 440

type SetBox = Readonly<{
  name: string
  bars: readonly Bar[]
  tone: BarTone
  nameWidth: number
}>

function setBoxRowsOf(
  stats: SetStats,
  catalog: OathCatalog | null,
  filter: SetStatsFilter
): readonly (readonly SetBox[])[] {
  const equipmentBars = equipmentSetBars(stats, filter)
  const oathBars = oathSetBars(stats, catalog, filter)
  const combos = comboBars(stats, filter)

  return [
    [
      {
        name: BOX_NAMES.equipment,
        bars: equipmentBars,
        tone: 'count',
        nameWidth: SET_NAME_WIDTH
      },
      {
        name: BOX_NAMES.oath,
        bars: oathBars,
        tone: 'chart-7',
        nameWidth: SET_NAME_WIDTH
      }
    ],
    [
      {
        name: BOX_NAMES.combo,
        bars: combos,
        tone: 'chart-3',
        nameWidth: COMBO_NAME_WIDTH
      }
    ]
  ]
}

const SKELETON_ROWS: readonly (readonly string[])[] = [
  [BOX_NAMES.equipment, BOX_NAMES.oath],
  [BOX_NAMES.combo]
]

function rowClass(boxCount: number): string {
  if (boxCount > 1) {
    return 'section section-cols'
  }

  return 'section'
}

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
          {SKELETON_ROWS.map((row) => (
            <div key={row.join()} className={rowClass(row.length)}>
              {row.map((name) => (
                <ListBox key={name} name={name}>
                  <span className="skeleton h-[224px]" />
                </ListBox>
              ))}
            </div>
          ))}
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
      {setBoxRowsOf(stats, oathCatalog, filter).map((row) => (
        <div key={row.map(({ name }) => name).join()} className={rowClass(row.length)}>
          {row.map((box) => (
            <ListBox key={box.name} name={box.name}>
              {empty ? (
                <p className="state">{EMPTY}</p>
              ) : (
                <RowBars
                  barFromMd
                  bars={box.bars}
                  tone={box.tone}
                  formatValue={formatShare}
                  nameWidth={box.nameWidth}
                />
              )}
            </ListBox>
          ))}
        </div>
      ))}
      <ItemStatsBoxes filter={filter} />
    </>
  )
}
