import { ChipGroup } from '@dfragon/ui'
import { useState } from 'react'
import type { ClearContent, ClearOverview } from '#entities/ranking'
import { BoxPlotChart } from '#shared/ui/chart/BoxPlot'
import { BoxPlotLegend } from '#shared/ui/chart/ChartLegend'
import { Columns } from '#shared/ui/chart/Columns'
import { LineChart } from '#shared/ui/chart/LineChart'
import { TitleBox } from '#shared/ui/TitleBox'
import {
  adventureColumns,
  type BaseContentOption,
  baseContentOptions,
  clearRateChart,
  type ContentCard,
  contentCards,
  defaultBaseContentId,
  distributionRows,
  hasClearTimes,
  hasRateValues,
  jobRanks,
  type OverviewWeek,
  overviewWeeks,
  RATE_PERIODS,
  type RatePeriod,
  splitAdventureColumns,
  weekRangeText,
  weekSummaryOf
} from './clear-overview'
import { BaseContentSelect } from './components/BaseContentSelect'
import { ClearContentCards } from './components/ClearContentCards'
import { ClearScreenSkeleton, ClearStatsSkeleton } from './components/ClearSkeleton'
import { CLEAR_TITLE, ClearTimePanel, ClearTitle, Panel } from './components/ClearPanel'
import { clearClasses } from './components/clear-classes'
import { useChoice } from './hooks/useChoice'
import { useClearContentStats, useClearOverview, useClearStats } from './api/useClearStats'
import {
  formatScoreTick,
  hasJobScores,
  JOB_METRIC_PLOT_LABELS,
  JOB_METRICS,
  jobMetricTickOf,
  scoreKindChoices
} from './clear-scores'
import { clearContentsOf } from './clear-groups'

const OVERVIEW_LAST_SINGLE_ADVENTURE_SIZE = 12
const OVERVIEW_ADVENTURE_RANGE_STARTS = [13]
const OVERVIEW_FRONT_ADVENTURE_COLUMNS = 5

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
  onContentOpen
}: {
  onContentOpen: (contentKey: string, weekStart: string) => void
}): React.JSX.Element {
  const result = useClearStats()
  switch (result.status) {
    case 'loading':
      return <ClearScreenSkeleton />
    case 'error':
      return (
        <div className={clearClasses.screen}>
          <TitleBox title={CLEAR_TITLE} />
          <p role="alert" className={clearClasses.state}>
            {result.message}
          </p>
        </div>
      )
    case 'success': {
      const contents = clearContentsOf(result.value)
      const weeks = overviewWeeks(contents)
      const selected = weeks.at(-1)
      if (selected === undefined) {
        return (
          <div className={clearClasses.screen}>
            <TitleBox title={CLEAR_TITLE} />
            <p className={clearClasses.empty}>수집 기록이 없습니다.</p>
          </div>
        )
      }

      return (
        <Overview
          contents={contents}
          weeks={weeks}
          selected={selected}
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
  onContentOpen
}: {
  contents: readonly ClearContent[]
  weeks: readonly OverviewWeek[]
  selected: OverviewWeek
  onContentOpen: (contentKey: string, weekStart: string) => void
}): React.JSX.Element {
  const { weekStart } = selected
  const result = useClearOverview(weekStart)

  function openContent(card: ContentCard): void {
    onContentOpen(card.key, weekStart)
  }

  return (
    <div className={clearClasses.screen}>
      <ClearTitle
        summary={weekSummaryOf(contents, weekStart)}
        period={weekRangeText(weekStart)}
        titleHidden
      />
      <ClearContentCards cards={contentCards(contents, weekStart)} onOpen={openContent} />
      {hasRateValues(contents) && (
        <ClearRatePanel contents={contents} weeks={weeks} weekStart={weekStart} />
      )}
      {result.status === 'loading' && <ClearStatsSkeleton />}
      {result.status === 'error' && (
        <p role="alert" className={clearClasses.state}>
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
  const { x, series } = clearRateChart(contents, weeks, weekStart, period)

  return (
    <Panel
      name="주간 클리어율"
      controls={
        <ChipGroup
          aria-label="기간"
          items={PERIOD_CHOICES}
          value={period}
          onValueChange={setPeriod}
        />
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
      <div className={clearClasses.row}>
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
      <div className={clearClasses.row}>
        {hasClearTimes(overview) && <ClearTimePanel times={overview} />}
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
          <ChipGroup aria-label="점수 종류" items={choices} value={kind} onValueChange={setKind} />
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
            <ChipGroup
              aria-label="분포"
              items={metricChoices}
              value={metric}
              onValueChange={setMetric}
            />
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
      <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
        {lists.map(({ name, rows }) => (
          <div key={name} className="flex min-w-0 flex-col">
            <p className={`${clearClasses.subLabel} px-4 pt-4`}>{name}</p>
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
      <div className="px-4 pb-4">
        <BoxPlotLegend />
      </div>
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
      name="모험단 기준 클리어 횟수"
      controls={
        <BaseContentSelect
          label="모험단 기준 클리어 횟수 기준 컨텐츠"
          options={options}
          value={baseId}
          onChange={onBaseChange}
        />
      }
    >
      {result.status === 'error' && (
        <p role="alert" className={clearClasses.bodyState}>
          {result.message}
        </p>
      )}
      {result.status === 'success' && (
        <Columns
          groups={splitAdventureColumns(
            adventureColumns(
              result.value.adventures,
              OVERVIEW_LAST_SINGLE_ADVENTURE_SIZE,
              OVERVIEW_ADVENTURE_RANGE_STARTS
            ),
            OVERVIEW_FRONT_ADVENTURE_COLUMNS
          )}
        />
      )}
    </Panel>
  )
}
