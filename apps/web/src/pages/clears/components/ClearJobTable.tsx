import { Button, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'
import { useRef, useState } from 'react'
import type { ClearJob } from '#core/ranking/clear-stats'
import { BoxPlot, BoxPlotAxis } from '../../../components/chart/BoxPlot'
import { BoxPlotLegend } from '../../../components/chart/ChartLegend'
import { boxPlotScale, type Scale } from '../../../components/chart/chart-geometry'
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
const PLOT_TICK_COUNT = 4

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
  const scale = boxPlotScale(
    shown.flatMap(({ stats }) => stats ?? []),
    PLOT_TICK_COUNT
  )

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
      <JobTable rows={shown} scale={scale} metric={metric} />
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

function JobTable({
  rows,
  scale,
  metric
}: {
  rows: readonly JobRow[]
  scale: Scale | undefined
  metric: JobMetric
}): React.JSX.Element {
  const formatTick = jobMetricTickOf(metric)
  const plotRef = useRef<HTMLSpanElement>(null)
  const { width } = useChartSize(plotRef, PLOT_FALLBACK)

  return (
    <table {...stylex.props(styles.table)}>
      <thead>
        <tr {...stylex.props(styles.headRow)}>
          <th scope="col" {...stylex.props(styles.head)}>
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
      <tbody>
        {rows.map((row) => (
          <JobTableRow key={row.key} row={row} scale={scale} width={width} />
        ))}
      </tbody>
    </table>
  )
}

function JobTableRow({
  row: { name, sub, counts, rate, stats },
  scale,
  width
}: {
  row: JobRow
  scale: Scale | undefined
  width: number
}): React.JSX.Element {
  return (
    <tr {...stylex.props(styles.row)}>
      <th scope="row" {...stylex.props(styles.cell, styles.name)}>
        {name}
        {sub !== null && <small {...stylex.props(styles.sub)}> {sub}</small>}
      </th>
      <td {...stylex.props(styles.cell, styles.value, styles.muted)}>{counts}</td>
      <td {...stylex.props(styles.cell)}>
        {stats !== null && scale !== undefined && (
          <>
            <span {...stylex.props(shapes.srOnly)}>{`중앙값 ${formatInteger(stats.median)}`}</span>
            <BoxPlot stats={stats} color={colors.chart1} scale={scale} width={width} />
          </>
        )}
      </td>
      <td {...stylex.props(styles.cell, styles.value)}>{rate}</td>
    </tr>
  )
}
