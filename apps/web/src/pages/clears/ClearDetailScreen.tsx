import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type {
  ClearContent,
  ClearContentStats,
  ClearWeek,
  ClearWeekOverWeek
} from '#core/ranking/clear-stats'
import { BarLineChart } from '../../components/chart/BarLineChart'
import { BoxPlotChart } from '../../components/chart/BoxPlot'
import { ChartLegend } from '../../components/chart/ChartLegend'
import { Columns } from '../../components/chart/Columns'
import { RowBars } from '../../components/chart/RowBars'
import { SplitBar } from '../../components/chart/SplitBar'
import { shareText } from '../../components/chart/stats-bars'
import { TitleBox } from '../../components/table/TitleBox'
import {
  contentWeeks,
  fameBandChart,
  findGroup,
  findStage,
  ratioBars,
  scoreBandColumns,
  stageBars,
  type SplitCard,
  stageChoices,
  stageMoveCard,
  streakColumns,
  weekGroupRows,
  weeklyClearChart,
  weekNumberText,
  weekOverWeekCard
} from './clear-detail'
import { clearContentsOf, type GroupedContent, KIND_LABELS } from './clear-groups'
import { bandScoreKindChoices, formatScoreTick, scoreKindChoices } from './clear-scores'
import { useChoice } from './hooks/useChoice'
import {
  adventureColumns,
  type ContentCard,
  contentCards,
  findOverviewWeek,
  hasClearTimes,
  type OverviewWeek,
  rateOf,
  weekChangeOf,
  weekOf
} from './clear-overview'
import { seoulDateOf } from './clear-weeks'
import { ChoiceGroup } from './components/ChoiceGroup'
import { ClearContentCards } from './components/ClearContentCards'
import { ClearJobTable } from './components/ClearJobTable'
import { CLEAR_TITLE, ClearTimePanel, ClearTitle, Panel } from './components/ClearPanel'
import { styles as layout } from './components/ClearPanel.style'
import { ClearWeekWheel } from './components/ClearWeekWheel'
import { useClearContentStats, useClearStats } from './hooks/useClearStats'
import { styles } from './ClearDetailScreen.style'

const DETAIL_LAST_ADVENTURE_SIZE = 17
const WIDE_PANEL = 2
// 1440×900 창에서 스크롤 없이 첫 줄 차트의 아래 끝까지 보이게 공용 기본 높이보다 낮춘다.
const FIRST_ROW_CHART_HEIGHT = 180

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

const CHART_FORMATS = {
  barTick: formatInteger,
  barValue: formatInteger,
  lineTick: formatRateTick,
  lineValue: formatRateValue
}

type DetailHandlers = Readonly<{
  onStageSelect: (stage: string) => void
  onWeekSelect: (weekStart: string) => void
  onContentOpen: (contentKey: string) => void
}>

export function ClearDetailScreen({
  contentKey,
  stage,
  week,
  ...handlers
}: DetailHandlers &
  Readonly<{
    contentKey: string
    stage: string | undefined
    week: string | undefined
  }>): React.JSX.Element {
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
      const group = findGroup(contents, contentKey)
      const chosen = group !== undefined ? findStage(group, stage) : undefined
      const selected =
        chosen !== undefined ? findOverviewWeek(contentWeeks(chosen.content), week) : undefined
      if (group === undefined || chosen === undefined || selected === undefined) {
        return (
          <div {...stylex.props(layout.screen)}>
            <TitleBox title={CLEAR_TITLE} />
            <p {...stylex.props(layout.empty)}>수집 기록이 없습니다.</p>
          </div>
        )
      }

      return (
        <Detail
          contents={contents}
          group={group}
          chosen={chosen}
          selected={selected}
          {...handlers}
        />
      )
    }
  }
}

function Detail({
  contents,
  group,
  chosen,
  selected,
  onStageSelect,
  onWeekSelect,
  onContentOpen
}: DetailHandlers &
  Readonly<{
    contents: readonly ClearContent[]
    group: readonly GroupedContent[]
    chosen: GroupedContent
    selected: OverviewWeek
  }>): React.JSX.Element {
  const { content, place } = chosen
  const { weekStart } = selected
  const week = weekOf(content, weekStart)
  const result = useClearContentStats(content.id, weekStart)

  function openCard(card: ContentCard): void {
    onContentOpen(card.key)
  }

  return (
    <div {...stylex.props(layout.screen)}>
      <ClearTitle summary={week} />
      <ClearContentCards
        cards={contentCards(contents, weekStart)}
        selectedKey={place.group.key}
        onOpen={openCard}
      />
      <ContentHead
        group={group}
        chosen={chosen}
        selected={selected}
        week={week}
        onStageSelect={onStageSelect}
        onWeekSelect={onWeekSelect}
      />
      {result.status === 'loading' && <div aria-hidden="true" {...stylex.props(layout.pending)} />}
      {result.status === 'error' && (
        <p role="alert" {...stylex.props(layout.state)}>
          {result.message}
        </p>
      )}
      {result.status === 'success' && week !== undefined && (
        <DetailStats stats={result.value} content={content} week={week} />
      )}
    </div>
  )
}

function ContentHead({
  group,
  chosen: { content, place },
  selected,
  week,
  onStageSelect,
  onWeekSelect
}: Readonly<{
  group: readonly GroupedContent[]
  chosen: GroupedContent
  selected: OverviewWeek
  week: ClearWeek | undefined
  onStageSelect: (stage: string) => void
  onWeekSelect: (weekStart: string) => void
}>): React.JSX.Element {
  const choices = stageChoices(group).map(({ slug, label }) => ({ value: slug, label }))
  const rate = week !== undefined ? rateOf(week) : null
  const change = rate !== null ? weekChangeOf(content, selected.weekStart, rate) : null
  const kind = `${KIND_LABELS[content.kind]} · 출시 ${seoulDateOf(Date.parse(content.releasedAt))}`

  function weekLabelOf(weekStart: string): string {
    return weekNumberText(weekStart, content.releasedAt)
  }

  return (
    <section aria-label="컨텐츠" {...stylex.props(styles.head)}>
      <div {...stylex.props(styles.headName)}>
        <span {...stylex.props(styles.headKind)}>{kind}</span>
        <h2 {...stylex.props(styles.headTitle)}>{place.group.name}</h2>
      </div>
      {place.choice !== null && (
        <ChoiceGroup
          label="단계"
          choices={choices}
          value={place.choice.slug}
          large
          onChange={onStageSelect}
        />
      )}
      {week !== undefined && (
        <dl {...stylex.props(styles.figures)}>
          <Figure label="클리어 캐릭터" value={integer.format(week.cleared)} />
          <Figure label="클리어 비율" value={shareText(week.cleared, week.population)} />
          {change !== null && (
            <Figure
              label="지난주 대비"
              value={change.text}
              tone={change.trend === 'flat' ? undefined : change.trend}
            />
          )}
        </dl>
      )}
      <ClearWeekWheel
        weeks={contentWeeks(content)}
        selected={selected}
        labelOf={weekLabelOf}
        onSelect={onWeekSelect}
      />
    </section>
  )
}

function Figure({
  label,
  value,
  tone
}: Readonly<{ label: string; value: string; tone?: 'up' | 'down' }>): React.JSX.Element {
  return (
    <div {...stylex.props(styles.figure)}>
      <dt {...stylex.props(styles.figureLabel)}>{label}</dt>
      <dd
        {...stylex.props(
          styles.figureValue,
          tone === 'up' && styles.up,
          tone === 'down' && styles.down
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function DetailStats({
  stats,
  content,
  week
}: Readonly<{
  stats: ClearContentStats
  content: ClearContent
  week: ClearWeek
}>): React.JSX.Element {
  const { releasedAt } = content
  const weekly = weeklyClearChart(stats, releasedAt)
  const fameBands = fameBandChart(stats)
  const groupRows =
    stats.weekOverWeek !== null ? weekGroupRows(stats.weekOverWeek, ({ fame }) => fame) : []
  const streaks = streakColumns(stats.streaks)
  const ratios = ratioBars(content, week)
  const stages = stageBars(stats.stages)
  const adventures = adventureColumns(stats.adventures, DETAIL_LAST_ADVENTURE_SIZE)
  const hasAdventures = stats.adventures.length > 0

  return (
    <>
      <div {...stylex.props(layout.row)}>
        {weekly.x.length > 0 && (
          <Panel name="주차별 클리어" grow={WIDE_PANEL}>
            <BarLineChart
              label="주차별 클리어"
              x={weekly.x}
              bars={weekly.bars}
              layout="stack"
              line={weekly.line}
              selectedKey={week.weekStart}
              formats={CHART_FORMATS}
              height={FIRST_ROW_CHART_HEIGHT}
            />
          </Panel>
        )}
        {fameBands.x.length > 0 && (
          <Panel name="명성 구간">
            <BarLineChart
              label="명성 구간"
              x={fameBands.x}
              bars={fameBands.bars}
              layout="overlap"
              line={fameBands.line}
              formats={CHART_FORMATS}
              height={FIRST_ROW_CHART_HEIGHT}
            />
          </Panel>
        )}
      </div>
      <div {...stylex.props(layout.row)}>
        {stats.weekOverWeek !== null && (
          <SplitPanel
            name="지난주 대비 이탈과 복귀"
            card={weekOverWeekCard(stats.weekOverWeek, week.weekStart, releasedAt)}
          />
        )}
        {stats.stageMoves !== null && (
          <SplitPanel
            name="일반과 하드 사이 이동"
            card={stageMoveCard(stats.stageMoves, week.weekStart, releasedAt)}
          />
        )}
      </div>
      <div {...stylex.props(layout.row)}>
        {groupRows.length > 0 && (
          <Panel name="클리어 캐릭터의 명성">
            <BoxPlotChart
              label="클리어 캐릭터의 명성"
              rows={groupRows}
              formatTick={formatInteger}
              formatValue={formatInteger}
            />
          </Panel>
        )}
        {stats.weekOverWeek !== null && <GroupScorePanel weekOverWeek={stats.weekOverWeek} />}
      </div>
      <div {...stylex.props(layout.row)}>
        {streaks.length > 0 && (
          <Panel name="연속 클리어 주 수">
            <Columns groups={[streaks]} />
          </Panel>
        )}
        {hasClearTimes(stats) && <ClearTimePanel times={stats} />}
      </div>
      <div {...stylex.props(layout.row)}>
        {ratios.length > 0 && (
          <Panel name="배율별 클리어">
            <RowBars bars={ratios} />
          </Panel>
        )}
      </div>
      <div {...stylex.props(layout.row)}>
        <ScoreBandPanel scoreBands={stats.scoreBands} />
        {stages.length > 0 && (
          <Panel name="단계별 클리어 캐릭터">
            <RowBars bars={stages} fill />
          </Panel>
        )}
      </div>
      <div {...stylex.props(layout.row)}>
        {hasAdventures && (
          <Panel name="모험단당 클리어 캐릭터">
            <Columns groups={[adventures]} />
          </Panel>
        )}
      </div>
      <ClearJobTable key={content.id} jobs={stats.jobs} />
    </>
  )
}

function GroupScorePanel({
  weekOverWeek
}: Readonly<{ weekOverWeek: ClearWeekOverWeek }>): React.JSX.Element | null {
  const { both, returned, left, first } = weekOverWeek
  const choices = scoreKindChoices([both, returned, left, first].map(({ scores }) => scores))
  const [kind, setKind] = useChoice(choices)
  if (kind === undefined) {
    return null
  }

  const rows = weekGroupRows(weekOverWeek, ({ scores }) => scores[kind])

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

function ScoreBandPanel({
  scoreBands
}: Readonly<{ scoreBands: ClearContentStats['scoreBands'] }>): React.JSX.Element | null {
  const choices = bandScoreKindChoices(scoreBands)
  const [kind, setKind] = useChoice(choices)
  if (kind === undefined) {
    return null
  }

  return (
    <Panel
      name="장비 점수 구간별 클리어율"
      controls={
        choices.length > 1 && (
          <ChoiceGroup label="점수 종류" choices={choices} value={kind} onChange={setKind} />
        )
      }
    >
      <Columns groups={[scoreBandColumns(scoreBands[kind])]} />
    </Panel>
  )
}

function SplitPanel({
  name,
  card
}: Readonly<{ name: string; card: SplitCard }>): React.JSX.Element {
  return (
    <Panel name={name}>
      <div {...stylex.props(styles.splitBody)}>
        <dl {...stylex.props(styles.splitFigures)}>
          {card.figures.map(({ label, value }) => (
            <Figure key={label} label={label} value={value} />
          ))}
        </dl>
        <div {...stylex.props(styles.splitRows)}>
          {card.rows.map(({ key, label, total, segments }) => (
            <div key={key} {...stylex.props(styles.splitRow)}>
              <span {...stylex.props(styles.splitLabel)}>
                <span {...stylex.props(styles.splitWeek)}>{label}</span>
                <span {...stylex.props(styles.splitTotal)}>{total}</span>
              </span>
              <SplitBar label={label} segments={segments} formatValue={formatInteger} />
            </div>
          ))}
        </div>
        <ChartLegend items={card.legend} below />
      </div>
    </Panel>
  )
}
