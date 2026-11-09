import { Popover } from '@base-ui/react/popover'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import type { ClearWeek } from '#core/ranking/clear-stats'
import { ChevronDownIcon } from '../../components/ChevronDownIcon'
import {
  addDays,
  type CalendarMonth,
  calendarWeeks,
  firstDateOf,
  lastDateOf,
  monthOf,
  seoulDateOf,
  shiftMonth,
  weekNumberOf,
  weekRangeLabel,
  weekStartOfDate
} from './clear-weeks'
import { styles } from './ClearWeekPicker.style'

const WEEKDAYS = ['목', '금', '토', '일', '월', '화', '수'] as const
const WEEK_LAST_DAY = 6

export function ClearWeekPicker({
  weeks,
  selected,
  releasedAt,
  onSelect
}: {
  weeks: readonly ClearWeek[]
  selected: ClearWeek
  releasedAt: string
  onSelect: (weekStart: string) => void
}): React.JSX.Element {
  const index = weeks.indexOf(selected)
  const previous = weeks[index - 1]
  const next = weeks[index + 1]

  function selectPrevious(): void {
    if (previous !== undefined) {
      onSelect(previous.weekStart)
    }
  }

  function selectNext(): void {
    if (next !== undefined) {
      onSelect(next.weekStart)
    }
  }

  return (
    <div {...stylex.props(styles.picker)}>
      {!selected.closed && <span {...stylex.props(styles.live)}>집계 중</span>}
      <NavButton
        label="이전 주"
        direction="left"
        disabled={previous === undefined}
        onClick={selectPrevious}
      />
      <WeekCalendar weeks={weeks} selected={selected} releasedAt={releasedAt} onSelect={onSelect} />
      <NavButton
        label="다음 주"
        direction="right"
        disabled={next === undefined}
        onClick={selectNext}
      />
    </div>
  )
}

function NavButton({
  label,
  direction,
  disabled,
  small = false,
  onClick
}: {
  label: string
  direction: 'left' | 'right'
  disabled: boolean
  small?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...stylex.props(styles.nav, small && styles.navSmall)}
    >
      <ChevronDownIcon
        {...stylex.props(direction === 'left' ? styles.chevronLeft : styles.chevronRight)}
      />
    </button>
  )
}

function WeekCalendar({
  weeks,
  selected,
  releasedAt,
  onSelect
}: {
  weeks: readonly ClearWeek[]
  selected: ClearWeek
  releasedAt: string
  onSelect: (weekStart: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<CalendarMonth>(() => monthOf(selected.weekStart))

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) {
      setMonth(monthOf(selected.weekStart))
    }
    setOpen(nextOpen)
  }

  function selectDate(date: string): void {
    onSelect(weekStartOfDate(date))
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        render={
          <button type="button" {...stylex.props(styles.trigger)}>
            {weekRangeLabel(selected.weekStart, releasedAt)}
            <ChevronDownIcon {...stylex.props(styles.chevronDown)} />
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          {...stylex.props(styles.positioner)}
        >
          <Popover.Popup aria-label="주 고르기" {...stylex.props(styles.popup)}>
            <MonthTable
              month={month}
              weeks={weeks}
              selected={selected}
              releasedAt={releasedAt}
              onMonthChange={setMonth}
              onSelect={selectDate}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function MonthTable({
  month,
  weeks,
  selected,
  releasedAt,
  onMonthChange,
  onSelect
}: {
  month: CalendarMonth
  weeks: readonly ClearWeek[]
  selected: ClearWeek
  releasedAt: string
  onMonthChange: (month: CalendarMonth) => void
  onSelect: (date: string) => void
}): React.JSX.Element {
  const [today] = useState(() => seoulDateOf(Date.now()))
  const [hoveredWeek, setHoveredWeek] = useState<string | null>(null)
  const storedWeeks = new Set(weeks.map(({ weekStart }) => weekStart))
  const first = weeks[0]?.weekStart
  const last = weeks.at(-1)?.weekStart
  const hasPrevious = first !== undefined && addDays(first, WEEK_LAST_DAY) < firstDateOf(month)
  const hasNext = last !== undefined && last > lastDateOf(month)

  function showPrevious(): void {
    onMonthChange(shiftMonth(month, -1))
  }

  function showNext(): void {
    onMonthChange(shiftMonth(month, 1))
  }

  function clearHover(): void {
    setHoveredWeek(null)
  }

  return (
    <>
      <div {...stylex.props(styles.header)}>
        <NavButton
          label="이전 달"
          direction="left"
          small
          disabled={!hasPrevious}
          onClick={showPrevious}
        />
        <h2 {...stylex.props(styles.month)}>{`${month.year}년 ${month.month}월`}</h2>
        <NavButton label="다음 달" direction="right" small disabled={!hasNext} onClick={showNext} />
      </div>
      <table onMouseLeave={clearHover} {...stylex.props(styles.table)}>
        <thead>
          <tr>
            <th scope="col" {...stylex.props(styles.weekday, styles.weekNumberHead)}>
              주차
            </th>
            {WEEKDAYS.map((weekday) => (
              <th key={weekday} scope="col" {...stylex.props(styles.weekday)}>
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendarWeeks(month).map(({ weekStart, days }) => {
            const stored = storedWeeks.has(weekStart)
            const isSelected = weekStart === selected.weekStart
            const hovered = stored && !isSelected && weekStart === hoveredWeek

            function hover(): void {
              setHoveredWeek(weekStart)
            }

            return (
              <tr key={weekStart} onMouseEnter={hover}>
                <td {...stylex.props(styles.weekNumber)}>
                  {stored ? weekNumberOf(weekStart, releasedAt) : null}
                </td>
                {days.map(({ date, day, inMonth }) => (
                  <td key={date} {...stylex.props(styles.dayCell)}>
                    <DayButton
                      date={date}
                      day={day}
                      disabled={!stored || date > today}
                      selected={isSelected}
                      outside={!inMonth}
                      hovered={hovered}
                      today={date === today}
                      onSelect={onSelect}
                    />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function DayButton({
  date,
  day,
  disabled,
  selected,
  outside,
  hovered,
  today,
  onSelect
}: {
  date: string
  day: number
  disabled: boolean
  selected: boolean
  outside: boolean
  hovered: boolean
  today: boolean
  onSelect: (date: string) => void
}): React.JSX.Element {
  function select(): void {
    onSelect(date)
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${Number(date.slice(5, 7))}월 ${day}일`}
      aria-pressed={selected}
      onClick={select}
      {...stylex.props(
        styles.day,
        outside && styles.outside,
        hovered && styles.hoverRow,
        selected && styles.selected,
        selected && outside && styles.selectedOutside,
        today && styles.today
      )}
    >
      {day}
    </button>
  )
}
