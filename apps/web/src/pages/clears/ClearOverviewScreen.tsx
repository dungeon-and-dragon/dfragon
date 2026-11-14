import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import type { ClearContent, ClearOverview } from '#core/ranking/clear-stats'
import { BoxPlotChart } from '../../components/chart/BoxPlot'
import { BoxPlotLegend } from '../../components/chart/ChartLegend'
import { Columns } from '../../components/chart/Columns'
import { LineChart } from '../../components/chart/LineChart'
import { RowBars } from '../../components/chart/RowBars'
import { TitleBox } from '../../components/table/TitleBox'
import {
  adventureColumns,
  type BaseContentOption,
  baseContentOptions,
  clearRateChart,
  coClearBars,
  type ContentCard,
  contentCards,
  defaultBaseContentId,
  distributionRows,
  findOverviewWeek,
  formatPercent,
  hasClearTimes,
  hasRateValues,
  jobRanks,
  type OverviewWeek,
  overviewWeeks,
  RATE_PERIODS,
  RATE_STAGES,
  type RatePeriod,
  type RateStage,
  weekSummaryOf
} from './clear-overview'
import { BaseContentSelect } from './components/BaseContentSelect'
import { ChoiceGroup } from './components/ChoiceGroup'
import { ClearContentCards } from './components/ClearContentCards'
import { ClearWeekWheel } from './components/ClearWeekWheel'
import { CLEAR_TITLE, ClearTimePanel, ClearTitle, Panel } from './components/ClearPanel'
import { styles as layout } from './components/ClearPanel.style'
import { useChoice } from './hooks/useChoice'
import { useClearContentStats, useClearOverview, useClearStats } from './hooks/useClearStats'
import {
  formatScoreTick,
  hasJobScores,
  JOB_METRIC_PLOT_LABELS,
  JOB_METRICS,
  jobMetricTickOf,
  scoreKindChoices
} from './clear-scores'
import { clearContentsOf } from './clear-groups'
import { styles } from './ClearOverviewScreen.style'

const OVERVIEW_LAST_ADVENTURE_SIZE = 13

const integer = new Intl.NumberFormat('ko-KR')

function formatInteger(value: number): string {
  return integer.format(value)
}

function formatRateTick(value: number): string {
  return `${value}%`
}

function formatRateValue(value: number): string {
  return `${value.toFixed(1)}%`
}

export function ClearOverviewScreen({
  week,
  onWeekSelect,
  onContentOpen
}: {
  week: string | undefined
  onWeekSelect: (weekStart: string) => void
  onContentOpen: (contentKey: string, weekStart: string) => void
}): React.JSX.Element {
  const result = useClearStats()
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" {...stylex.props(layout.screen)}>
          <span role="status" {...stylex.props(shapes.srOnly)}>
            클리어 집계를 받는 중입니다.
          </span>
          <TitleBox title={CLEAR_TITLE} />
        </div>
      )
    case 'error':
      return (
        <div {...stylex.props(layout.screen)}>
          <TitleBox title={CLEAR_TITLE} />
          <p role="alert" {...stylex.props(layout.state)}>
            {result.message}
          </p>
        </div>
      )
    case 'success': {
      const contents = clearContentsOf(result.value)
      const weeks = overviewWeeks(contents)
      const selected = findOverviewWeek(weeks, week)
      if (selected === undefined) {
        return (
          <div {...stylex.props(layout.screen)}>
            <TitleBox title={CLEAR_TITLE} />
            <p {...stylex.props(layout.empty)}>수집 기록이 없습니다.</p>
          </div>
        )
      }

      return (
        <Overview
          contents={contents}
          weeks={weeks}
          selected={selected}
          onWeekSelect={onWeekSelect}
          onContentOpen={onContentOpen}
        />
      )
    }
  }
}

function Overview({
  contents,
  weeks,
  selected,
  onWeekSelect,
  onContentOpen
}: {
  contents: readonly ClearContent[]
  weeks: readonly OverviewWeek[]
  selected: OverviewWeek
  onWeekSelect: (weekStart: string) => void
  onContentOpen: (contentKey: string, weekStart: string) => void
}): React.JSX.Element {
  const { weekStart } = selected
  const result = useClearOverview(weekStart)

  function openContent(card: ContentCard): void {
    onContentOpen(card.key, weekStart)
  }

  return (
    <div {...stylex.props(layout.screen)}>
      <ClearTitle summary={weekSummaryOf(contents, weekStart)}>
        <ClearWeekWheel weeks={weeks} selected={selected} onSelect={onWeekSelect} />
      </ClearTitle>
      <ClearContentCards cards={contentCards(contents, weekStart)} onOpen={openContent} />
      {hasRateValues(contents) && (
        <ClearRatePanel contents={contents} weeks={weeks} weekStart={weekStart} />
      )}
      {result.status === 'error' && (
        <p role="alert" {...stylex.props(layout.state)}>
          {result.message}
        </p>
      )}
      {result.status === 'success' && (
        <OverviewStats overview={result.value} contents={contents} weekStart={weekStart} />
      )}
    </div>
  )
}

const PERIOD_CHOICES = RATE_PERIODS.map(({ period, label }) => ({ value: period, label }))
const STAGE_CHOICES = RATE_STAGES.map(({ stage, label }) => ({ value: stage, label }))

function ClearRatePanel({
  contents,
  weeks,
  weekStart
}: {
  contents: readonly ClearContent[]
  weeks: readonly OverviewWeek[]
  weekStart: string
}): React.JSX.Element {
  const [period, setPeriod] = useState<RatePeriod>('half')
  const [stage, setStage] = useState<RateStage>('hard')
  const { x, series } = clearRateChart(contents, weeks, weekStart, period, stage)

  return (
    <Panel
      name="주간 클리어율"
      controls={
        <>
          <ChoiceGroup label="기간" choices={PERIOD_CHOICES} value={period} onChange={setPeriod} />
          <ChoiceGroup label="단계" choices={STAGE_CHOICES} value={stage} onChange={setStage} />
        </>
      }
    >
      <LineChart
        label="주간 클리어율"
        x={x}
        series={series}
        formatTick={formatRateTick}
        formatValue={formatRateValue}
      />
    </Panel>
  )
}

function useBaseContent(
  options: readonly BaseContentOption[],
  contents: readonly ClearContent[]
): [string | undefined, (id: string) => void] {
  const [chosen, setChosen] = useState<string>()
  const id = options.some((option) => option.id === chosen)
    ? chosen
    : defaultBaseContentId(options, contents)

  return [id, setChosen]
}

function OverviewStats({
  overview,
  contents,
  weekStart
}: {
  overview: ClearOverview
  contents: readonly ClearContent[]
  weekStart: string
}): React.JSX.Element {
  const options = baseContentOptions(overview, contents)
  const fames = distributionRows(overview, contents, ({ fame }) => fame)

  return (
    <>
      <div {...stylex.props(layout.row)}>
        {fames.length > 0 && (
          <Panel name="클리어 캐릭터의 명성">
            <BoxPlotChart
              label="클리어 캐릭터의 명성"
              rows={fames}
              formatTick={formatInteger}
              formatValue={formatInteger}
            />
          </Panel>
        )}
        <ScorePanel overview={overview} contents={contents} />
      </div>
      <JobPanel overview={overview} contents={contents} options={options} />
      <div {...stylex.props(layout.row)}>
        {hasClearTimes(overview) && <ClearTimePanel times={overview} />}
        <CoClearPanel overview={overview} contents={contents} options={options} />
        <AdventurePanel contents={contents} options={options} weekStart={weekStart} />
      </div>
    </>
  )
}

function ScorePanel({
  overview,
  contents
}: {
  overview: ClearOverview
  contents: readonly ClearContent[]
}): React.JSX.Element | null {
  const choices = scoreKindChoices(overview.contents.map(({ scores }) => scores))
  const [kind, setKind] = useChoice(choices)
  if (kind === undefined) {
    return null
  }

  const rows = distributionRows(overview, contents, ({ scores }) => scores[kind])

  return (
    <Panel
      name="클리어 캐릭터의 장비 점수"
      controls={
        choices.length > 1 && (
          <ChoiceGroup label="점수 종류" choices={choices} value={kind} onChange={setKind} />
        )
      }
    >
      <BoxPlotChart
        label="클리어 캐릭터의 장비 점수"
        rows={rows}
        formatTick={formatScoreTick}
        formatValue={formatInteger}
      />
    </Panel>
  )
}

const JOB_NAME_WIDTH = 140

function JobPanel({
  overview,
  contents,
  options
}: {
  overview: ClearOverview
  contents: readonly ClearContent[]
  options: readonly BaseContentOption[]
}): React.JSX.Element | null {
  const [baseId, setBaseId] = useBaseContent(options, contents)
  const base = overview.contents.find(({ id }) => id === baseId)
  const metricChoices = base !== undefined && hasJobScores(base.jobs) ? JOB_METRICS : []
  const [chosenMetric, setMetric] = useChoice(metricChoices)
  if (base === undefined) {
    return null
  }

  const metric = chosenMetric ?? 'fame'
  const { high, low } = jobRanks(base.jobs, metric)
  const domain = [...high, ...low].flatMap(({ stats }) => stats ?? [])
  if (domain.length === 0) {
    return null
  }

  const lists = [
    { name: '클리어율 높은 전직', rows: high },
    { name: '클리어율 낮은 전직', rows: low }
  ].filter(({ rows }) => rows.length > 0)

  return (
    <Panel
      name="전직별 클리어"
      controls={
        <>
          {metricChoices.length > 0 && (
            <ChoiceGroup label="분포" choices={metricChoices} value={metric} onChange={setMetric} />
          )}
          <BaseContentSelect
            label="전직별 클리어 기준 컨텐츠"
            options={options}
            value={base.id}
            onChange={setBaseId}
          />
        </>
      }
    >
      <div {...stylex.props(styles.jobLists)}>
        {lists.map(({ name, rows }) => (
          <div key={name} {...stylex.props(styles.jobList)}>
            <p {...stylex.props(layout.subLabel, styles.jobListTitle)}>{name}</p>
            <BoxPlotChart
              label={name}
              rows={rows}
              domain={domain}
              head={{ name: '전직', plot: JOB_METRIC_PLOT_LABELS[metric], value: '클리어율' }}
              nameWidth={JOB_NAME_WIDTH}
              legend={false}
              formatTick={jobMetricTickOf(metric)}
              formatValue={formatInteger}
            />
          </div>
        ))}
      </div>
      <div {...stylex.props(styles.jobLegend)}>
        <BoxPlotLegend />
      </div>
    </Panel>
  )
}

function CoClearPanel({
  overview,
  contents,
  options
}: {
  overview: ClearOverview
  contents: readonly ClearContent[]
  options: readonly BaseContentOption[]
}): React.JSX.Element | null {
  const [baseId, setBaseId] = useBaseContent(options, contents)
  const base = overview.contents.find(({ id }) => id === baseId)
  const option = options.find(({ id }) => id === baseId)
  if (base === undefined || option === undefined) {
    return null
  }

  const bars = coClearBars(overview, contents, base.id)
  if (bars.length === 0) {
    return null
  }

  return (
    <Panel
      name="함께 깬 컨텐츠"
      controls={
        <BaseContentSelect
          label="함께 깬 컨텐츠 기준 컨텐츠"
          options={options}
          value={base.id}
          onChange={setBaseId}
        />
      }
    >
      <div {...stylex.props(styles.coClearHead)}>
        <span {...stylex.props(layout.subLabel)}>{`${option.label} 클리어 캐릭터`}</span>
        <span {...stylex.props(styles.coClearCount)}>{integer.format(base.cleared)}</span>
      </div>
      <RowBars bars={bars} max={1} formatValue={formatPercent} />
    </Panel>
  )
}

function AdventurePanel({
  contents,
  options,
  weekStart
}: {
  contents: readonly ClearContent[]
  options: readonly BaseContentOption[]
  weekStart: string
}): React.JSX.Element | null {
  const [baseId, setBaseId] = useBaseContent(options, contents)
  if (baseId === undefined) {
    return null
  }

  return (
    <AdventureStats
      baseId={baseId}
      options={options}
      weekStart={weekStart}
      onBaseChange={setBaseId}
    />
  )
}

function AdventureStats({
  baseId,
  options,
  weekStart,
  onBaseChange
}: {
  baseId: string
  options: readonly BaseContentOption[]
  weekStart: string
  onBaseChange: (id: string) => void
}): React.JSX.Element | null {
  const result = useClearContentStats(baseId, weekStart)
  if (result.status === 'success' && result.value.adventures.length === 0) {
    return null
  }

  return (
    <Panel
      name="모험단당 클리어 캐릭터"
      controls={
        <BaseContentSelect
          label="모험단당 클리어 캐릭터 기준 컨텐츠"
          options={options}
          value={baseId}
          onChange={onBaseChange}
        />
      }
    >
      {result.status === 'error' && (
        <p role="alert" {...stylex.props(layout.bodyState)}>
          {result.message}
        </p>
      )}
      {result.status === 'success' && (
        <Columns
          groups={[adventureColumns(result.value.adventures, OVERVIEW_LAST_ADVENTURE_SIZE)]}
        />
      )}
    </Panel>
  )
}
