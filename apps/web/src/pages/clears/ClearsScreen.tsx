import { Button, Chip, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { formatSeoulDateTime } from '#core/time-format'
import type { ClearContent, ClearJob, ClearWeek } from '#core/ranking/clear-stats'
import { styles as listBoxStyles } from '../../components/table/ListBox.style'
import { ListBox } from '../../components/table/ListBox'
import { TitleBox, TitleStat } from '../../components/table/TitleBox'
import { useClearContentStats, useClearStats } from './hooks/useClearStats'
import { findClearContentBackground } from '../../lib/clear-content-background'
import { type ColumnBar, Columns } from '../../components/chart/Columns'
import { type Bar, RowBars } from '../../components/chart/RowBars'
import { TableRail } from './components/TableRail'
import { ROW_BAR_GROW, useChartBarGrow } from '../../animations/useChartBarGrow'
import { shareText } from '../../components/chart/stats-bars'
import { SeasonBackdrop } from '../../components/SeasonBackdrop'
import {
  adventureBars,
  contentKindLabel,
  contentRows,
  findSelectedContent,
  findSelectedWeek,
  type JobRow,
  type JobSort,
  jobRows,
  ratioBars
} from './clear-contents'
import type { ClearSearch } from './clear-search'
import { seoulDateOf, weekLabel } from './clear-weeks'
import { ClearWeekPicker } from './ClearWeekPicker'
import { styles } from './ClearsScreen.style'

const TITLE = '클리어 집계'
const VISIBLE_JOB_COUNT = 10
const WEEK_AXIS_STEP = 4
const YEAR_WEEK_AXIS_STEP = 13
const WEEKS_PER_YEAR = 52

const integer = new Intl.NumberFormat('ko-KR')

export function ClearsScreen({
  search,
  onSearchChange
}: {
  search: ClearSearch
  onSearchChange: (search: ClearSearch) => void
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
      const content = findSelectedContent(contents, search.content)
      if (content === undefined) {
        return (
          <div {...stylex.props(styles.screen)}>
            <TitleBox title={TITLE} />
          </div>
        )
      }
      const week = findSelectedWeek(content, search.week)

      function selectContent(id: string): void {
        onSearchChange({ content: id })
      }

      function selectWeek(weekStart: string): void {
        onSearchChange({ content: content?.id, week: weekStart })
      }

      return (
        <div {...stylex.props(styles.screen)}>
          <ClearTitle week={week} />
          <ContentPicker contents={contents} selectedId={content.id} onSelect={selectContent} />
          <section aria-label="클리어" {...stylex.props(styles.box)}>
            <ClearHero content={content} week={week} onWeekSelect={selectWeek} />
            {week === undefined && <p {...stylex.props(styles.empty)}>수집 기록이 없습니다.</p>}
            {week !== undefined && content.weeks.length > 1 && (
              <div key={content.id} {...stylex.props(styles.weekChart)}>
                <Columns groups={[weekBars(content)]} selectedKey={week.weekStart} scrollable />
              </div>
            )}
          </section>
          {week !== undefined && <ContentDetail key={content.id} content={content} week={week} />}
        </div>
      )
    }
  }
}

function ClearTitle({ week }: { week: ClearWeek | undefined }): React.JSX.Element {
  const [now] = useState(Date.now)
  if (week === undefined) {
    return <TitleBox title={TITLE} />
  }

  return (
    <TitleBox title={TITLE}>
      <TitleStat label="모집단" value={`명성 상위 ${integer.format(week.population)}`} />
      {week.minFame !== null && (
        <TitleStat
          label="최저 명성"
          value={<span {...stylex.props(styles.fame)}>{integer.format(week.minFame)}</span>}
        />
      )}
      <TitleStat label="수집 시각" value={formatSeoulDateTime(week.collectedAt, now)} />
    </TitleBox>
  )
}

function ContentPicker({
  contents,
  selectedId,
  onSelect
}: {
  contents: readonly ClearContent[]
  selectedId: string
  onSelect: (id: string) => void
}): React.JSX.Element {
  return (
    <section aria-label="컨텐츠" {...stylex.props(styles.box, styles.contents)}>
      {contentRows(contents).map(({ label, contents: rowContents }) => (
        <div key={label} {...stylex.props(styles.contentRow)}>
          <h2 {...stylex.props(styles.contentKind)}>{label}</h2>
          {rowContents.map(({ id, name }) => (
            <OptionChip key={id} value={id} pressed={id === selectedId} onSelect={onSelect}>
              {name}
            </OptionChip>
          ))}
        </div>
      ))}
    </section>
  )
}

function OptionChip<Value>({
  value,
  pressed,
  onSelect,
  children
}: {
  value: Value
  pressed: boolean
  onSelect: (value: Value) => void
  children: string
}): React.JSX.Element {
  function select(): void {
    onSelect(value)
  }

  return (
    <Chip pressed={pressed} onPressedChange={select}>
      {children}
    </Chip>
  )
}

function ClearHero({
  content,
  week,
  onWeekSelect
}: {
  content: ClearContent
  week: ClearWeek | undefined
  onWeekSelect: (weekStart: string) => void
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.hero)}>
      <SeasonBackdrop url={findClearContentBackground(content.id)} />
      <div {...stylex.props(styles.heroHead)}>
        <span {...stylex.props(styles.heroKind)}>{contentKindLabel(content)}</span>
        <h2 {...stylex.props(styles.heroName)}>{content.name}</h2>
        <span {...stylex.props(styles.heroRelease)}>
          출시 {seoulDateOf(Date.parse(content.releasedAt))}
        </span>
      </div>
      {week !== undefined && (
        <div {...stylex.props(styles.heroBottom)}>
          <dl {...stylex.props(styles.figures)}>
            <Figure label="클리어 캐릭터" value={integer.format(week.cleared)} main />
            <Figure label="클리어 비율" value={shareText(week.cleared, week.population)} />
            {week.newlyCleared !== null && (
              <Figure label="이번 주 신규" value={integer.format(week.newlyCleared)} />
            )}
          </dl>
          <ClearWeekPicker
            weeks={content.weeks}
            selected={week}
            releasedAt={content.releasedAt}
            onSelect={onWeekSelect}
          />
        </div>
      )}
    </div>
  )
}

function Figure({
  label,
  value,
  main = false
}: {
  label: string
  value: string
  main?: boolean
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.figure)}>
      <dt {...stylex.props(styles.figureLabel)}>{label}</dt>
      <dd {...stylex.props(styles.figureValue, main && styles.figureMain)}>{value}</dd>
    </div>
  )
}

// 한 해를 넘기면 MM-DD가 겹치므로 연도를 붙이고, 라벨이 길어진 만큼 간격을 넓힌다.
function weekAxisLabelOf(
  weeks: readonly ClearWeek[]
): (weekStart: string, index: number) => string | null {
  if (weeks.length > WEEKS_PER_YEAR) {
    return (weekStart, index) => {
      if (index % YEAR_WEEK_AXIS_STEP !== 0) {
        return null
      }

      return weekStart.slice(2)
    }
  }

  return (weekStart, index) => {
    if (index % WEEK_AXIS_STEP !== 0) {
      return null
    }

    return weekStart.slice(5)
  }
}

function weekBars({ weeks, releasedAt }: ClearContent): ColumnBar[] {
  const max = Math.max(0, ...weeks.map(({ cleared }) => cleared))
  const axisLabelOf = weekAxisLabelOf(weeks)

  return weeks.map(({ weekStart, cleared, population }, index) => {
    const label = axisLabelOf(weekStart, index)
    const range = weekLabel(weekStart, releasedAt)
    const share = shareText(cleared, population)
    const ratio = max > 0 ? cleared / max : 0

    return { key: weekStart, label, range, count: cleared, share, ratio }
  })
}

function ContentDetail({
  content,
  week
}: {
  content: ClearContent
  week: ClearWeek
}): React.JSX.Element {
  const result = useClearContentStats(content.id, week.weekStart)
  const detail = result.status === 'success' ? result.value : undefined

  return (
    <>
      <div {...stylex.props(styles.pair)}>
        {content.kind === 'raid' && <BarBox name="배율별 클리어" bars={ratioBars(week)} />}
        <BarBox name="모험단별 분포" bars={adventureBars(detail?.adventures ?? [])} />
      </div>
      {result.status === 'error' && (
        <p role="alert" {...stylex.props(styles.state)}>
          {result.message}
        </p>
      )}
      <JobBox jobs={detail?.jobs ?? []} />
    </>
  )
}

function BarBox({ name, bars }: { name: string; bars: readonly Bar[] }): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name={name} />
  }

  return (
    <ListBox name={name}>
      <RowBars bars={bars} />
    </ListBox>
  )
}

const JOB_SORTS: readonly { sort: JobSort; label: string }[] = [
  { sort: 'cleared', label: '클리어 순' },
  { sort: 'rate', label: '클리어율 순' }
]

function JobBox({ jobs }: { jobs: readonly ClearJob[] }): React.JSX.Element {
  const [sort, setSort] = useState<JobSort>('cleared')
  const [expanded, setExpanded] = useState(false)
  const rows = jobRows(jobs, sort)
  const shown = expanded ? rows : rows.slice(0, VISIBLE_JOB_COUNT)

  function expand(): void {
    setExpanded(true)
  }

  return (
    <section aria-label="직업별 클리어" {...stylex.props(listBoxStyles.box)}>
      <div
        {...stylex.props(
          listBoxStyles.name,
          rows.length > 0 && listBoxStyles.divider,
          styles.boxHeader
        )}
      >
        <h2 {...stylex.props(styles.boxTitle)}>직업별 클리어</h2>
        <div {...stylex.props(styles.sortChips)}>
          {JOB_SORTS.map((option) => (
            <OptionChip
              key={option.sort}
              value={option.sort}
              pressed={sort === option.sort}
              onSelect={setSort}
            >
              {option.label}
            </OptionChip>
          ))}
        </div>
      </div>
      {rows.length > 0 && <JobTable rows={shown} />}
      {!expanded && rows.length > VISIBLE_JOB_COUNT && (
        <div {...stylex.props(styles.more)}>
          <Button variant="secondary" onClick={expand}>
            전직 {rows.length}개 모두 보기
          </Button>
        </div>
      )}
    </section>
  )
}

function JobTable({ rows }: { rows: readonly JobRow[] }): React.JSX.Element {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const maxRate = Math.max(0, ...rows.map(({ rate }) => rate ?? 0))
  useChartBarGrow(bodyRef, ROW_BAR_GROW)

  function clearHover(): void {
    setHoveredKey(null)
  }

  return (
    <div {...stylex.props(styles.jobTableScroll)}>
      <table {...stylex.props(styles.jobTable)}>
        <thead>
          <tr {...stylex.props(styles.jobHeadRow)}>
            <th scope="col" {...stylex.props(styles.jobHead, styles.jobHeadName)}>
              전직
            </th>
            <th scope="col" {...stylex.props(styles.jobHead, styles.jobHeadValue)}>
              모집단
            </th>
            <th scope="col" {...stylex.props(styles.jobHead, styles.jobHeadValue)}>
              클리어
            </th>
            <th scope="col" {...stylex.props(styles.jobHead, styles.jobHeadRate)}>
              클리어율
            </th>
          </tr>
        </thead>
        <tbody ref={bodyRef} onMouseLeave={clearHover}>
          {rows.map((row) => (
            <JobTableRow
              key={row.key}
              row={row}
              percent={maxRate > 0 ? ((row.rate ?? 0) / maxRate) * 100 : 0}
              active={row.key === hoveredKey}
              dimmed={hoveredKey !== null && row.key !== hoveredKey}
              onHover={setHoveredKey}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JobTableRow({
  row: { key, name, population, cleared, rate },
  percent,
  active,
  dimmed,
  onHover
}: {
  row: JobRow
  percent: number
  active: boolean
  dimmed: boolean
  onHover: (key: string) => void
}): React.JSX.Element {
  function handleMouseEnter(): void {
    onHover(key)
  }

  return (
    <tr
      data-chart-item=""
      onMouseEnter={handleMouseEnter}
      {...stylex.props(styles.jobRow, active && styles.jobRowActive)}
    >
      <th scope="row" {...stylex.props(styles.jobCell, styles.jobName)}>
        {name}
      </th>
      <td {...stylex.props(styles.jobCell, styles.jobValue, styles.jobPopulation)}>
        {integer.format(population)}
      </td>
      <td {...stylex.props(styles.jobCell, styles.jobValue)}>{integer.format(cleared)}</td>
      <td {...stylex.props(styles.jobCell)}>
        <span {...stylex.props(styles.jobRate)}>
          <TableRail percent={percent} active={active} dimmed={dimmed} />
          <span {...stylex.props(styles.jobValue)}>
            {rate === null ? '-' : shareText(cleared, population)}
          </span>
        </span>
      </td>
    </tr>
  )
}
