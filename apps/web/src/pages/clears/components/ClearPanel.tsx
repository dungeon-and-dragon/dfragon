import * as stylex from '@stylexjs/stylex'
import { type ReactNode, useState } from 'react'
import { formatSeoulDateTime } from '#core/time-format'
import type { ClearTimes } from '#core/ranking/clear-stats'
import { Columns } from '../../../components/chart/Columns'
import { TitleStat } from '../../../components/table/TitleBox'
import { hourColumns, type WeekSummary, weekdayColumns } from '../clear-overview'
import { styles } from './ClearPanel.style'

export const CLEAR_TITLE = '클리어 집계'
const TIME_COLUMN_HEIGHT = 64

const integer = new Intl.NumberFormat('ko-KR')

export function ClearTitle({
  summary,
  children
}: {
  summary: WeekSummary | undefined
  children?: ReactNode
}): React.JSX.Element {
  const [now] = useState(Date.now)

  return (
    <header {...stylex.props(styles.title)}>
      <h1 {...stylex.props(styles.titleText)}>{CLEAR_TITLE}</h1>
      {children}
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

export function Panel({
  name,
  controls,
  grow,
  children
}: {
  name: string
  controls?: ReactNode
  grow?: number
  children: ReactNode
}): React.JSX.Element {
  return (
    <section
      aria-label={name}
      {...stylex.props(styles.panel, grow !== undefined && styles.panelGrow(grow))}
    >
      <div {...stylex.props(styles.panelHead)}>
        <h2 {...stylex.props(styles.panelTitle)}>{name}</h2>
        {controls}
      </div>
      <div {...stylex.props(styles.panelBody)}>{children}</div>
    </section>
  )
}

export function ClearTimePanel({ times }: { times: ClearTimes }): React.JSX.Element {
  return (
    <Panel name="클리어 요일과 시간대">
      <div {...stylex.props(styles.columnsBlock)}>
        <p {...stylex.props(styles.subLabel, styles.columnsLabel)}>요일</p>
        <Columns groups={[weekdayColumns(times)]} height={TIME_COLUMN_HEIGHT} />
      </div>
      <div {...stylex.props(styles.columnsBlock)}>
        <p {...stylex.props(styles.subLabel, styles.columnsLabel)}>시간대</p>
        <Columns groups={[hourColumns(times)]} height={TIME_COLUMN_HEIGHT} />
      </div>
    </Panel>
  )
}
