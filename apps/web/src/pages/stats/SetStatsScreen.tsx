import {
  SET_SAMPLE_MIN_FAME,
  SET_SAMPLE_TOP_COUNT,
  SET_SAMPLES,
  type SetSample
} from '@dfragon/lib'
import { ChipGroup, type ChipGroupItem } from '@dfragon/ui'
import { RelativeTime } from '#shared/ui/RelativeTime'
import { type Bar, type BarTone, RowBars } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import { TitleBox, TitleStat } from '#shared/ui/TitleBox'
import { type OathCatalog, useOathCatalog } from '#entities/catalog'
import {
  type FameRankingFilter,
  type SetStats,
  type SetStatsFilter,
  useSetStats
} from '#entities/ranking'
import { type FilterRow, RankingFilterBox } from '#widgets/ranking-filter'
import { ItemStatsBoxes } from './ItemStatsBoxes'
import { StatsTabs } from './StatsTabs'
import { comboBars, equipmentSetBars, formatShare, oathSetBars } from './set-stats-bars'

const integer = new Intl.NumberFormat('ko-KR')
const TITLE = '세트 통계'
const EMPTY = '세트 통계가 없습니다.'
const FAILED = '세트 통계를 받지 못했습니다.'
const BOX_NAMES = {
  equipment: '장비 세트',
  oath: '서약 세트',
  combo: '장비와 서약 조합'
} as const
const SAMPLE_LABEL = '표본'
const SAMPLE_NAMES: Record<SetSample, string> = {
  top: `상위 ${SET_SAMPLE_TOP_COUNT}명`,
  fame: `명성 ${integer.format(SET_SAMPLE_MIN_FAME)} 이상`,
  all: '전체'
}
const SAMPLE_ITEMS: readonly ChipGroupItem<SetSample>[] = SET_SAMPLES.map((sample) => ({
  value: sample,
  label: SAMPLE_NAMES[sample]
}))
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

  // 직업, 전직을 바꿔도 고른 표본은 그대로 둔다.
  function changeJob({ jobId, jobGrowId, role }: FameRankingFilter): void {
    onFilterChange({ jobId, jobGrowId, role, sample: filter.sample })
  }

  function changeSample(sample: SetSample): void {
    const selected = sample === 'all' ? undefined : sample

    onFilterChange({ ...filter, sample: selected })
  }

  const rows: readonly FilterRow[] = [
    {
      label: SAMPLE_LABEL,
      content: (
        <ChipGroup
          aria-label={SAMPLE_LABEL}
          items={SAMPLE_ITEMS}
          value={filter.sample ?? 'all'}
          onValueChange={changeSample}
        />
      )
    }
  ]

  const filterBox = <RankingFilterBox filter={filter} onChange={changeJob} rows={rows} />

  if (result.status === 'error') {
    return (
      <>
        <TitleBox title={TITLE} />
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
        <span role="status" className="sr-only">
          세트 통계를 받는 중입니다.
        </span>
        <TitleBox title={TITLE} />
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
      <TitleBox title={TITLE}>
        {stats.computedAt !== null && (
          <>
            <TitleStat label="캐릭터" value={integer.format(stats.sampleSize)} />
            <TitleStat
              label="마지막 업데이트 시간"
              value={<RelativeTime at={stats.computedAt} />}
              numeric={false}
            />
          </>
        )}
      </TitleBox>
      {filterBox}
      {setBoxRowsOf(stats, oathCatalog, filter).map((row) => (
        <div key={row.map(({ name }) => name).join()} className={rowClass(row.length)}>
          {row.map((box) => (
            <ListBox key={box.name} name={box.name}>
              {empty ? (
                <p className="state">{EMPTY}</p>
              ) : (
                <RowBars
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
