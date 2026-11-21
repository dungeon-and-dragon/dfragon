import type { ReactNode } from 'react'
import type { ClearTimes } from '#entities/ranking'
import { Columns } from '#shared/ui/chart/Columns'
import { TitleStat } from '#shared/ui/TitleBox'
import { hourColumns, type WeekSummary, weekdayColumns } from '#pages/clears/clear-overview'
import { clearClasses } from './clear-classes'

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
  return (
    <header className="section screen-head flex-wrap justify-start">
      <h1 className="screen-title mr-6">{CLEAR_TITLE}</h1>
      {children}
      {summary !== undefined && (
        <div className="ml-auto flex flex-wrap gap-x-6 gap-y-2 max-sm:gap-x-4">
          {summary.minFame !== null && (
            <TitleStat
              label="기준 명성"
              numeric={false}
              value={
                <span className="text-game-fame">
                  <span className="num">{integer.format(summary.minFame)}</span>
                  {' 이상'}
                </span>
              }
            />
          )}
          <TitleStat label="캐릭터 수" value={integer.format(summary.population)} />
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
      className="section flex min-w-0 grow basis-0 flex-col"
      style={grow !== undefined ? { flexGrow: grow } : undefined}
    >
      <div className="section-title flex-wrap py-2">
        <h2 className="grow">{name}</h2>
        {controls}
      </div>
      <div className="flex grow flex-col">{children}</div>
    </section>
  )
}

export function ClearTimePanel({ times }: { times: ClearTimes }): React.JSX.Element {
  return (
    <Panel name="클리어 요일과 시간대">
      <div className="relative flex grow flex-col">
        <p className={`${clearClasses.subLabel} absolute top-4 left-4`}>요일</p>
        <Columns groups={[weekdayColumns(times)]} height={TIME_COLUMN_HEIGHT} />
      </div>
      <div className="relative flex grow flex-col">
        <p className={`${clearClasses.subLabel} absolute top-4 left-4`}>시간대</p>
        <Columns groups={[hourColumns(times)]} height={TIME_COLUMN_HEIGHT} />
      </div>
    </Panel>
  )
}
