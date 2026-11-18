import { Button, ChipGroup } from '@dfragon/ui'
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
import { Panel } from './ClearPanel'
import { tableClasses } from '../../../components/table/table-classes'

const VISIBLE_JOB_COUNT = 10
const PLOT_FALLBACK = { width: 320, height: 20 }
const PLOT_COLOR = 'var(--color-chart-1)'
const HEAD = `${tableClasses.headCell} py-1 align-top`
const VALUE = 'text-right font-mono tabular-nums'

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
            <ChipGroup
              aria-label="분포"
              items={metricChoices}
              value={metric}
              onValueChange={setMetric}
            />
          )}
          <ChipGroup aria-label="정렬" items={JOB_SORTS} value={sort} onValueChange={setSort} />
        </>
      }
    >
      <JobTable rows={shown} metric={metric} />
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
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

  return boxStatsTooltipRows(stats, PLOT_COLOR, formatInteger)
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
    // 넓은 화면에서는 스크롤 영역을 두지 않는다. 두면 아래쪽 행의 툴팁이 영역 밖으로 나간 만큼 잘린다.
    <div className="max-sm:overflow-x-auto">
      <div ref={chartRef} className="relative max-sm:min-w-[720px]">
        <table className={tableClasses.table}>
          <thead>
            <tr>
              <th scope="col" className={`${HEAD} w-[184px] text-left`}>
                전직
              </th>
              <th scope="col" className={`${HEAD} w-[112px] text-right`}>
                클리어 / 캐릭터 수
              </th>
              <th scope="col" className={`${HEAD} text-left`}>
                {JOB_METRIC_PLOT_LABELS[metric]}
                <span ref={plotRef} className="mt-1 block">
                  {scale !== undefined && (
                    <BoxPlotAxis scale={scale} width={width} formatTick={formatTick} />
                  )}
                </span>
              </th>
              <th scope="col" className={`${HEAD} w-16 text-right`}>
                클리어율
              </th>
            </tr>
          </thead>
          <tbody
            onMouseLeave={handleLeave}
            className={`${tableClasses.body} [&>tr:last-child>th]:border-b-0`}
          >
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
    <tr
      onMouseEnter={stats !== null ? handleMouseEnter : undefined}
      className={`${tableClasses.row} transition-colors`}
    >
      <th scope="row" className={`${tableClasses.cell} truncate text-left font-normal`}>
        {name}
        {sub !== null && <small className="text-xs text-fg-subtle"> {sub}</small>}
      </th>
      <td className={`${tableClasses.cell} ${VALUE} text-fg-muted`}>{counts}</td>
      <td ref={plotRef} className={tableClasses.cell}>
        {stats !== null && scale !== undefined && (
          <>
            <span className="sr-only">{description}</span>
            <BoxPlot stats={stats} color={PLOT_COLOR} scale={scale} width={width} />
          </>
        )}
      </td>
      <td className={`${tableClasses.cell} ${VALUE}`}>{rate}</td>
    </tr>
  )
}
