import { Button, ChipGroup } from '@dfragon/ui'
import { useRef, useState } from 'react'
import type { ClearJob } from '#entities/ranking'
import { useChartTooltipSlide } from '#shared/ui/chart/useChartTooltipSlide'
import { BoxPlot, BoxPlotAxis } from '#shared/ui/chart/BoxPlot'
import {
  boxPlotScaleFor,
  boxPlotTooltipPlaceOf,
  boxStatsTooltipRows
} from '#shared/ui/chart/box-plot-layout'
import { BoxPlotLegend } from '#shared/ui/chart/ChartLegend'
import type { Scale } from '#shared/ui/chart/chart-geometry'
import { ChartTooltip } from '#shared/ui/chart/plot-parts'
import type { TooltipRow } from '#shared/ui/chart/plot-layout'
import { useChartHover } from '#shared/ui/chart/useChartHover'
import { useChartSize } from '#shared/ui/chart/useChartSize'
import { JOB_SORTS, type JobRow, type JobSort, jobRows } from '#pages/clears/clear-detail'
import {
  hasJobScores,
  JOB_METRIC_PLOT_LABELS,
  JOB_METRICS,
  type JobMetric,
  jobMetricTickOf
} from '#pages/clears/clear-scores'
import { useChoice } from '#pages/clears/hooks/useChoice'
import { Panel } from './ClearPanel'

const VISIBLE_JOB_COUNT = 10
const PLOT_FALLBACK = { width: 320, height: 20 }
const PLOT_COLOR = 'var(--color-chart-1)'
// 축 눈금을 함께 담는 두 줄 헤더라 위로 맞추고 위아래 여백을 줄인다.
const HEAD = 'py-1 align-top'
const COUNTS_LABEL = '클리어 / 캐릭터 수'

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

// 클리어와 캐릭터 수는 계열이 아니라 색 표식 없이 둔다.
function tooltipRowsOf(row: JobRow): TooltipRow[] {
  const counts = { key: 'counts', name: COUNTS_LABEL, color: 'transparent', value: row.counts }

  return [counts, ...statsRowsOf(row)]
}

function JobTable({
  rows,
  metric
}: {
  rows: readonly JobRow[]
  metric: JobMetric
}): React.JSX.Element {
  const { hover, show, areaProps } = useChartHover()
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

  const shownTitle = shownRow?.name
  const shownRows = shownRow != null ? tooltipRowsOf(shownRow) : []

  return (
    // 넓은 화면에서는 스크롤 영역을 두지 않는다. 두면 아래쪽 행의 툴팁이 영역 밖으로 나간 만큼 잘린다.
    <div className="max-sm:overflow-x-auto">
      <div ref={chartRef} className="relative max-sm:min-w-[720px]">
        <table className="table table-fixed">
          <thead>
            <tr>
              <th scope="col" className={`${HEAD} w-[184px]`}>
                전직
              </th>
              <th scope="col" className={HEAD}>
                {JOB_METRIC_PLOT_LABELS[metric]}
                <span ref={plotRef} className="mt-1 block">
                  {scale !== undefined && (
                    <BoxPlotAxis scale={scale} width={width} formatTick={formatTick} />
                  )}
                </span>
              </th>
              <th scope="col" className={`${HEAD} table-num w-16`}>
                클리어율
              </th>
            </tr>
          </thead>
          <tbody {...areaProps}>
            {rows.map((row) => (
              <JobTableRow
                key={row.key}
                row={row}
                scale={scale}
                width={width}
                onHover={show}
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
  onHover: (key: string) => void
  anchorsRef: React.RefObject<Map<string, HTMLElement>>
}): React.JSX.Element {
  const { key, name, counts, rate, stats } = row
  const description = statsRowsOf(row)
    .map(({ name: statName, value }) => `${statName} ${value}`)
    .join(', ')

  function handleMouseEnter(): void {
    onHover(key)
  }

  function plotRef(element: HTMLTableCellElement): () => void {
    anchorsRef.current.set(key, element)

    return () => {
      anchorsRef.current.delete(key)
    }
  }

  return (
    <tr onMouseEnter={handleMouseEnter}>
      <th scope="row" className="text-left font-normal">
        {name}
        <span className="sr-only">{`, ${COUNTS_LABEL} ${counts}`}</span>
      </th>
      <td ref={plotRef}>
        {stats !== null && scale !== undefined && (
          <>
            <span className="sr-only">{description}</span>
            <BoxPlot stats={stats} color={PLOT_COLOR} scale={scale} width={width} />
          </>
        )}
      </td>
      <td className="table-num">{rate}</td>
    </tr>
  )
}
