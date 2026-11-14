import { Button, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'
import { useRef, useState } from 'react'
import type { ClearJob } from '#core/ranking/clear-stats'
import { useChartTooltipSlide } from '../../../animations/useChartTooltipSlide'
import { BoxPlot, BoxPlotAxis } from '../../../components/chart/BoxPlot'
import {
  boxPlotScaleFor,
  boxPlotTooltipPlaceOf,
  boxStatsTooltipRows
} from '../../../components/chart/box-plot-layout'
import { BoxPlotLegend } from '../../../components/chart/ChartLegend'
import type { Scale } from '../../../components/chart/chart-geometry'
import { ChartTooltip } from '../../../components/chart/plot-parts'
import { type Hover, NO_HOVER, type TooltipRow } from '../../../components/chart/plot-layout'
import { useChartSize } from '../../../components/chart/useChartSize'
import { JOB_SORTS, type JobRow, type JobSort, jobRows } from '../clear-detail'
import {
  hasJobScores,
  JOB_METRIC_PLOT_LABELS,
  JOB_METRICS,
  type JobMetric,
  jobMetricTickOf
} from '../clear-scores'
import { useChoice } from '../hooks/useChoice'
import { ChoiceGroup } from './ChoiceGroup'
import { Panel } from './ClearPanel'
import { styles } from './ClearJobTable.style'

const VISIBLE_JOB_COUNT = 10
const PLOT_FALLBACK = { width: 320, height: 20 }

const integer = new Intl.NumberFormat('ko-KR')

function formatInteger(value: number): string {
  return integer.format(value)
}

export function ClearJobTable({ jobs }: { jobs: readonly ClearJob[] }): React.JSX.Element | null {
  const [sort, setSort] = useState<JobSort>('rate')
  const [expanded, setExpanded] = useState(false)
  const metricChoices = hasJobScores(jobs) ? JOB_METRICS : []
  const [chosenMetric, setMetric] = useChoice(metricChoices)
  const metric = chosenMetric ?? 'fame'
  const rows = jobRows(jobs, sort, metric)
  if (rows.length === 0) {
    return null
  }

  const shown = expanded ? rows : rows.slice(0, VISIBLE_JOB_COUNT)

  function expand(): void {
    setExpanded(true)
  }

  return (
    <Panel
      name="전직별 클리어"
      controls={
        <>
          {metricChoices.length > 0 && (
            <ChoiceGroup label="분포" choices={metricChoices} value={metric} onChange={setMetric} />
          )}
          <ChoiceGroup label="정렬" choices={JOB_SORTS} value={sort} onChange={setSort} />
        </>
      }
    >
      <JobTable rows={shown} metric={metric} />
      <div {...stylex.props(styles.foot)}>
        <BoxPlotLegend />
        {!expanded && rows.length > VISIBLE_JOB_COUNT && (
          <Button variant="secondary" onClick={expand}>
            전직 {rows.length}개 모두 보기
          </Button>
        )}
      </div>
    </Panel>
  )
}

function statsRowsOf({ stats }: JobRow): TooltipRow[] {
  if (stats === null) {
    return []
  }

  return boxStatsTooltipRows(stats, colors.chart1, formatInteger)
}

function JobTable({
  rows,
  metric
}: {
  rows: readonly JobRow[]
  metric: JobMetric
}): React.JSX.Element {
  const [hover, setHover] = useState<Hover>(NO_HOVER)
  const formatTick = jobMetricTickOf(metric)
  const chartRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const anchorsRef = useRef(new Map<string, HTMLElement>())
  const { width } = useChartSize(plotRef, PLOT_FALLBACK)
  const scale = boxPlotScaleFor(
    rows.flatMap(({ stats }) => stats ?? []),
    width
  )
  const shownRow = rows.find(({ key }) => key === hover.key)
  useChartTooltipSlide({
    chartRef,
    tooltipRef,
    anchorsRef,
    shownKey: shownRow?.key,
    open: hover.open,
    bars: rows,
    placeOf: boxPlotTooltipPlaceOf
  })

  function handleLeave(): void {
    setHover(({ key }) => ({ key, open: false }))
  }

  const shownTitle =
    shownRow != null ? [shownRow.name, shownRow.sub].filter(Boolean).join(' ') : undefined
  const shownRows = shownRow != null ? statsRowsOf(shownRow) : []

  return (
    <div ref={chartRef} {...stylex.props(styles.chart)}>
      <table {...stylex.props(styles.table)}>
        <thead>
          <tr {...stylex.props(styles.headRow)}>
            <th scope="col" {...stylex.props(styles.head, styles.headName)}>
              전직
            </th>
            <th scope="col" {...stylex.props(styles.head, styles.headCounts)}>
              클리어 / 캐릭터 수
            </th>
            <th scope="col" {...stylex.props(styles.head, styles.headPlot)}>
              {JOB_METRIC_PLOT_LABELS[metric]}
              <span ref={plotRef} {...stylex.props(styles.axis)}>
                {scale !== undefined && (
                  <BoxPlotAxis scale={scale} width={width} formatTick={formatTick} />
                )}
              </span>
            </th>
            <th scope="col" {...stylex.props(styles.head, styles.headRate)}>
              클리어율
            </th>
          </tr>
        </thead>
        <tbody onMouseLeave={handleLeave}>
          {rows.map((row) => (
            <JobTableRow
              key={row.key}
              row={row}
              scale={scale}
              width={width}
              onHover={setHover}
              anchorsRef={anchorsRef}
            />
          ))}
        </tbody>
      </table>
      <ChartTooltip tooltipRef={tooltipRef} title={shownTitle} rows={shownRows} />
    </div>
  )
}

function JobTableRow({
  row,
  scale,
  width,
  onHover,
  anchorsRef
}: {
  row: JobRow
  scale: Scale | undefined
  width: number
  onHover: (hover: Hover) => void
  anchorsRef: React.RefObject<Map<string, HTMLElement>>
}): React.JSX.Element {
  const { key, name, sub, counts, rate, stats } = row
  const description = statsRowsOf(row)
    .map(({ name: statName, value }) => `${statName} ${value}`)
    .join(', ')

  function handleMouseEnter(): void {
    onHover({ key, open: true })
  }

  function plotRef(element: HTMLTableCellElement): () => void {
    anchorsRef.current.set(key, element)

    return () => {
      anchorsRef.current.delete(key)
    }
  }

  return (
    <tr onMouseEnter={stats !== null ? handleMouseEnter : undefined} {...stylex.props(styles.row)}>
      <th scope="row" {...stylex.props(styles.cell, styles.name)}>
        {name}
        {sub !== null && <small {...stylex.props(styles.sub)}> {sub}</small>}
      </th>
      <td {...stylex.props(styles.cell, styles.value, styles.muted)}>{counts}</td>
      <td ref={plotRef} {...stylex.props(styles.cell)}>
        {stats !== null && scale !== undefined && (
          <>
            <span {...stylex.props(shapes.srOnly)}>{description}</span>
            <BoxPlot stats={stats} color={colors.chart1} scale={scale} width={width} />
          </>
        )}
      </td>
      <td {...stylex.props(styles.cell, styles.value)}>{rate}</td>
    </tr>
  )
}
