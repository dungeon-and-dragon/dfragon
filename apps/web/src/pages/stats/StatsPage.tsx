import { Fragment } from 'react'
import { BarLineChart } from '#shared/ui/chart/BarLineChart'
import { Columns } from '#shared/ui/chart/Columns'
import { type Bar, type BarTone, RowBars } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import { StatsTabs } from '#widgets/stats-tabs'
import { useCharacterStats } from './api/useCharacterStats'
import {
  type FameBar,
  fameBars,
  type JobFameChart,
  jobFameChart,
  serverBars
} from '#entities/ranking'
import { StatsNote } from './StatsNote'

const SCREEN = 'flex flex-col'
const STAT_BOX_NAMES = {
  server: '서버 인구',
  fame: '명성 분포',
  jobFame: '직업별 명성'
} as const

type StatBoxId = keyof typeof STAT_BOX_NAMES
const STAT_BOX_ROWS: readonly (readonly StatBoxId[])[] = [['server', 'fame'], ['jobFame']]

function rowClassOf(row: readonly StatBoxId[]): string {
  if (row.length > 1) {
    return 'section section-cols'
  }

  return 'section'
}

export function StatsPage(): React.JSX.Element {
  return (
    <div className={SCREEN}>
      <StatsTabs />
      <CharacterStatsBody />
    </div>
  )
}

function CharacterStatsBody(): React.JSX.Element {
  const result = useCharacterStats()
  switch (result.status) {
    case 'loading':
      return <StatsSkeleton />
    case 'error':
      return (
        <div className={SCREEN}>
          <p role="alert" className="section state state-error">
            {result.message}
          </p>
        </div>
      )
    case 'success': {
      const stats = result.value
      const boxes: Record<StatBoxId, React.JSX.Element> = {
        server: <StatBox name={STAT_BOX_NAMES.server} bars={serverBars(stats)} />,
        fame: <FameBox bars={fameBars(stats)} />,
        jobFame: <JobFameBox chart={jobFameChart(stats)} />
      }

      return (
        <div className={SCREEN}>
          <StatsNote count={stats.total} computedAt={stats.computedAt} />
          {STAT_BOX_ROWS.map((row) => (
            <div key={row.join()} className={rowClassOf(row)}>
              {row.map((id) => (
                <Fragment key={id}>{boxes[id]}</Fragment>
              ))}
            </div>
          ))}
        </div>
      )
    }
  }
}

function StatsSkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true" className={SCREEN}>
      <div aria-hidden="true">
        {STAT_BOX_ROWS.map((row) => (
          <div key={row.join()} className={rowClassOf(row)}>
            {row.map((id) => (
              <ListBox key={id} name={STAT_BOX_NAMES[id]}>
                <span className="skeleton h-[256px]" />
              </ListBox>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatBox({
  name,
  bars,
  tone
}: {
  name: string
  bars: readonly Bar[]
  tone?: BarTone
}): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name={name} />
  }

  return (
    <ListBox name={name}>
      <RowBars bars={bars} tone={tone} barFromMd />
    </ListBox>
  )
}

function fameGroupsOf(bars: readonly FameBar[]): FameBar[][] {
  return Object.values(Object.groupBy(bars, ({ group }) => group)).filter((group) => group != null)
}

function FameBox({ bars }: { bars: readonly FameBar[] }): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name={STAT_BOX_NAMES.fame} />
  }

  return (
    <ListBox name={STAT_BOX_NAMES.fame} fillHeight>
      <Columns groups={fameGroupsOf(bars)} />
    </ListBox>
  )
}

const JOB_FAME_CHART_HEIGHT = 320
// 좁은 화면에서는 막대 아래 직업 이름이 들어가도록 막대 한 칸을 이 폭으로 넓혀 가로로 스크롤한다.
const JOB_FAME_NARROW_STEP = 72
const integer = new Intl.NumberFormat('ko-KR')
const manwon = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1, useGrouping: false })

function manText(value: number): string {
  if (value === 0) {
    return '0'
  }

  return `${manwon.format(value / 10_000)}만`
}

const JOB_FAME_FORMATS = {
  barTick: manText,
  barValue: (value: number) => integer.format(value),
  lineTick: manText,
  lineValue: manText
}

function JobFameBox({ chart }: { chart: JobFameChart }): React.JSX.Element {
  if (chart.x.length === 0) {
    return <ListBox name={STAT_BOX_NAMES.jobFame} />
  }

  return (
    <ListBox name={STAT_BOX_NAMES.jobFame} fillHeight>
      <BarLineChart
        label={STAT_BOX_NAMES.jobFame}
        x={chart.x}
        bars={chart.bars}
        layout="stack"
        formats={JOB_FAME_FORMATS}
        height={JOB_FAME_CHART_HEIGHT}
        narrowStep={JOB_FAME_NARROW_STEP}
        toggleable
        sortByTotal
        barShares
      />
    </ListBox>
  )
}
