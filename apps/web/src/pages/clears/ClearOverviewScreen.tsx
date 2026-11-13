import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { type ReactNode, useState } from 'react'
import { formatSeoulDateTime } from '#core/time-format'
import type { ClearContent, ClearOverview } from '#core/ranking/clear-stats'
import { BoxPlotChart } from '../../components/chart/BoxPlot'
import { BoxPlotLegend } from '../../components/chart/ChartLegend'
import { boxPlotScale } from '../../components/chart/chart-geometry'
import { Columns } from '../../components/chart/Columns'
import { LineChart } from '../../components/chart/LineChart'
import { RowBars } from '../../components/chart/RowBars'
import { TitleBox, TitleStat } from '../../components/table/TitleBox'
import {
  adventureColumns,
  type BaseContentOption,
  baseContentOptions,
  clearRateChart,
  coClearBars,
  contentCards,
  defaultBaseContentId,
  fameRows,
  findOverviewWeek,
  formatPercent,
  hasClearTimes,
  hasRateValues,
  hourColumns,
  jobRanks,
  type OverviewWeek,
  overviewWeeks,
  RATE_PERIODS,
  RATE_STAGES,
  type RatePeriod,
  type RateStage,
  weekdayColumns,
  weekSummaryOf
} from './clear-overview'
import { BaseContentSelect } from './components/BaseContentSelect'
import { ChoiceGroup } from './components/ChoiceGroup'
import { ClearContentCards } from './components/ClearContentCards'
import { ClearWeekWheel } from './components/ClearWeekWheel'
import { useClearContentStats, useClearOverview, useClearStats } from './hooks/useClearStats'
import { styles } from './ClearOverviewScreen.style'

const TITLE = '클리어 집계'
const TIME_COLUMN_HEIGHT = 64

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
  onContentOpen: (contentId: string, weekStart: string) => void
}): React.JSX.Element {
  const result = useClearStats()
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" {...stylex.props(styles.screen)}>
          <span role="status" {...stylex.props(shapes.srOnly)}>
            클리어 집계를 받는 중입니다.
          </span>
          <TitleBox title={TITLE} />
        </div>
      )
    case 'error':
      return (
        <div {...stylex.props(styles.screen)}>
          <TitleBox title={TITLE} />
          <p role="alert" {...stylex.props(styles.state)}>
            {result.message}
          </p>
        </div>
      )
    case 'success': {
      const { contents } = result.value
      const weeks = overviewWeeks(contents)
      const selected = findOverviewWeek(weeks, week)
      if (selected === undefined) {
        return (
          <div {...stylex.props(styles.screen)}>
            <TitleBox title={TITLE} />
            <p {...stylex.props(styles.empty)}>수집 기록이 없습니다.</p>
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
  onContentOpen: (contentId: string, weekStart: string) => void
}): React.JSX.Element {
  const { weekStart } = selected
  const result = useClearOverview(weekStart)

  function openContent(contentId: string): void {
    onContentOpen(contentId, weekStart)
  }

  return (
    <div {...stylex.props(styles.screen)}>
      <OverviewTitle
        contents={contents}
        weeks={weeks}
        selected={selected}
        onWeekSelect={onWeekSelect}
      />
      <ClearContentCards cards={contentCards(contents, weekStart)} onOpen={openContent} />
      {hasRateValues(contents) && (
        <ClearRatePanel contents={contents} weeks={weeks} weekStart={weekStart} />
      )}
      {result.status === 'error' && (
        <p role="alert" {...stylex.props(styles.state)}>
          {result.message}
        </p>
      )}
      {result.status === 'success' && (
        <OverviewStats overview={result.value} contents={contents} weekStart={weekStart} />
      )}
    </div>
  )
}

function OverviewTitle({
  contents,
  weeks,
  selected,
  onWeekSelect
}: {
  contents: readonly ClearContent[]
  weeks: readonly OverviewWeek[]
  selected: OverviewWeek
  onWeekSelect: (weekStart: string) => void
}): React.JSX.Element {
  const [now] = useState(Date.now)
  const summary = weekSummaryOf(contents, selected.weekStart)

  return (
    <header {...stylex.props(styles.title)}>
      <h1 {...stylex.props(styles.titleText)}>{TITLE}</h1>
      <ClearWeekWheel weeks={weeks} selected={selected} onSelect={onWeekSelect} />
      {summary !== undefined && (
        <div {...stylex.props(styles.titleStats)}>
          {summary.minFame !== null && (
            <TitleStat
              label="기준 명성"
              value={
                <span {...stylex.props(styles.fame)}>
                  {`${integer.format(summary.minFame)} 이상`}
                </span>
              }
            />
          )}
          <TitleStat label="캐릭터 수" value={integer.format(summary.population)} />
          <TitleStat label="수집 시각" value={formatSeoulDateTime(summary.collectedAt, now)} />
        </div>
      )}
    </header>
  )
}

function Panel({
  name,
  controls,
  children
}: {
  name: string
  controls?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-label={name} {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.panelHead)}>
        <h2 {...stylex.props(styles.panelTitle)}>{name}</h2>
        {controls}
      </div>
      <div {...stylex.props(styles.panelBody)}>{children}</div>
    </section>
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
  const fames = fameRows(overview, contents)

  return (
    <>
      {fames.length > 0 && (
        <div {...stylex.props(styles.row)}>
          <Panel name="클리어 캐릭터의 명성">
            <BoxPlotChart
              label="클리어 캐릭터의 명성"
              rows={fames}
              formatTick={formatInteger}
              formatValue={formatInteger}
            />
          </Panel>
        </div>
      )}
      <JobPanel overview={overview} contents={contents} options={options} />
      <div {...stylex.props(styles.row)}>
        {hasClearTimes(overview) && <ClearTimePanel overview={overview} />}
        <CoClearPanel overview={overview} contents={contents} options={options} />
        <AdventurePanel contents={contents} options={options} weekStart={weekStart} />
      </div>
    </>
  )
}

const JOB_HEAD = { name: '전직', plot: '클리어 캐릭터의 명성', value: '클리어율' }
const JOB_NAME_WIDTH = 150
// 반 폭 열에 명성 눈금 여섯 개가 들어가지 않아 줄인다.
const JOB_TICK_COUNT = 3

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
  if (base === undefined) {
    return null
  }

  const { high, low } = jobRanks(base.jobs)
  const scale = boxPlotScale(
    [...high, ...low].map(({ stats }) => stats),
    JOB_TICK_COUNT
  )
  if (scale == null) {
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
        <BaseContentSelect
          label="전직별 클리어 기준 컨텐츠"
          options={options}
          value={base.id}
          onChange={setBaseId}
        />
      }
    >
      <div {...stylex.props(styles.jobLists)}>
        {lists.map(({ name, rows }) => (
          <div key={name} {...stylex.props(styles.jobList)}>
            <p {...stylex.props(styles.subLabel, styles.jobListTitle)}>{name}</p>
            <BoxPlotChart
              label={name}
              rows={rows}
              scale={scale}
              head={JOB_HEAD}
              nameWidth={JOB_NAME_WIDTH}
              legend={false}
              formatTick={formatInteger}
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

function ClearTimePanel({ overview }: { overview: ClearOverview }): React.JSX.Element {
  return (
    <Panel name="클리어 요일과 시간대">
      <div {...stylex.props(styles.columnsBlock)}>
        <p {...stylex.props(styles.subLabel, styles.columnsLabel)}>요일</p>
        <Columns groups={[weekdayColumns(overview)]} height={TIME_COLUMN_HEIGHT} />
      </div>
      <div {...stylex.props(styles.columnsBlock)}>
        <p {...stylex.props(styles.subLabel, styles.columnsLabel)}>시간대</p>
        <Columns groups={[hourColumns(overview)]} height={TIME_COLUMN_HEIGHT} />
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
        <span {...stylex.props(styles.subLabel)}>{`${option.label} 클리어 캐릭터`}</span>
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
        <p role="alert" {...stylex.props(styles.bodyState)}>
          {result.message}
        </p>
      )}
      {result.status === 'success' && (
        <Columns groups={[adventureColumns(result.value.adventures)]} />
      )}
    </Panel>
  )
}
