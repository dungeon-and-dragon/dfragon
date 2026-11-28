import { BarLineChart } from '#shared/ui/chart/BarLineChart'
import { Columns } from '#shared/ui/chart/Columns'
import { ListBox } from '#shared/ui/ListBox'
import { StatsTabs } from '#widgets/stats-tabs'
import { useCharacterStats } from './api/useCharacterStats'
import { type FameBar, fameBars, type JobFameChart, jobFameChart } from '#entities/ranking'
import { StatsNote } from './StatsNote'

const SCREEN = 'flex flex-col'
const STAT_BOX_NAMES = {
  fame: '명성 분포',
  jobFame: '직업별 명성'
} as const

type StatBoxId = keyof typeof STAT_BOX_NAMES
const STAT_BOX_IDS: readonly StatBoxId[] = ['fame', 'jobFame']

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
        fame: <FameBox bars={fameBars(stats)} />,
        jobFame: <JobFameBox chart={jobFameChart(stats)} />
      }

      return (
        <div className={SCREEN}>
          <StatsNote count={stats.total} computedAt={stats.computedAt} />
          {STAT_BOX_IDS.map((id) => (
            <div key={id} className="section">
              {boxes[id]}
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
        {STAT_BOX_IDS.map((id) => (
          <div key={id} className="section">
            <ListBox name={STAT_BOX_NAMES[id]}>
              <span className="skeleton h-[256px]" />
            </ListBox>
          </div>
        ))}
      </div>
    </div>
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
