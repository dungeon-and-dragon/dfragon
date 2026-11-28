import { Link } from '@tanstack/react-router'
import { useRef } from 'react'
import { COLUMN_BAR_GROW, useChartBarGrow } from '#shared/ui/chart/useChartBarGrow'
import { useChartHover } from '#shared/ui/chart/useChartHover'
import { useChartTooltipSlide } from '#shared/ui/chart/useChartTooltipSlide'
import {
  besideTooltipPlaceOf,
  TOOLTIP_CLASS,
  TOOLTIP_COUNT_CLASS,
  TOOLTIP_TITLE_CLASS
} from '#shared/ui/chart/plot-layout'
import { formatShare, type SetColumn } from './set-stats-bars'

const COLUMN_BODY_CLASS = 'flex grow flex-col items-center gap-2 no-underline'
// 축 선은 아래 padding 16px, 이름 위 간격 8px, 이름 높이 14px를 더한 38px 위에 긋는다.
const COLUMNS_CLASS =
  "relative m-0 flex grow list-none gap-2 p-4 after:absolute after:inset-x-4 after:bottom-[38px] after:h-px after:bg-line-strong after:content-['']"

// 선택지 비율은 aria-hidden 툴팁에만 보이므로 스크린 리더에는 막대 이름에 함께 읽힌다.
function accessibleNameOf({ name, value, options }: SetColumn): string {
  const optionNames = options.map(
    (option) => `${option.position} ${option.name} ${formatShare(option.share)}`
  )

  return [`${name} ${formatShare(value)}`, ...optionNames].join(', ')
}

function maxValueOf(columns: readonly SetColumn[]): number {
  return Math.max(0, ...columns.map(({ value }) => value))
}

export function SetColumns({ columns }: { columns: readonly SetColumn[] }): React.JSX.Element {
  const { hover, show, areaProps } = useChartHover()
  const chartRef = useRef<HTMLUListElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef(new Map<string, HTMLLIElement>())
  const shownColumn = columns.find(({ key }) => key === hover.key)
  const max = maxValueOf(columns)
  useChartBarGrow(chartRef, COLUMN_BAR_GROW)
  useChartTooltipSlide({
    chartRef,
    tooltipRef,
    anchorsRef: columnsRef,
    shownKey: shownColumn?.key,
    open: hover.open,
    bars: columns,
    placeOf: besideTooltipPlaceOf
  })

  function registerColumn(key: string, element: HTMLLIElement): () => void {
    columnsRef.current.set(key, element)

    return () => {
      columnsRef.current.delete(key)
    }
  }

  return (
    <div className="relative flex grow flex-col">
      <ul ref={chartRef} {...areaProps} className={COLUMNS_CLASS}>
        {columns.map((column) => (
          <Column
            key={column.key}
            column={column}
            ratio={max > 0 ? column.value / max : 0}
            dimmed={hover.open && column.key !== hover.key}
            onHover={show}
            register={registerColumn}
          />
        ))}
      </ul>
      <div ref={tooltipRef} aria-hidden="true" className={`${TOOLTIP_CLASS} top-4`}>
        {shownColumn != null && <ColumnTooltip column={shownColumn} />}
      </div>
    </div>
  )
}

function ColumnTooltip({ column }: { column: SetColumn }): React.JSX.Element {
  return (
    <>
      <span className={TOOLTIP_TITLE_CLASS}>{column.name}</span>
      <span className={TOOLTIP_COUNT_CLASS}>{formatShare(column.value)}</span>
      {column.options.length > 0 && (
        <span className="mt-1 grid grid-cols-[auto_auto_auto] gap-x-2 text-xs">
          {column.options.map(({ position, name, share }) => (
            <span key={position} className="contents">
              <span className="text-fg-subtle">{position}</span>
              <span>{name}</span>
              <span className="num text-right font-semibold">{formatShare(share)}</span>
            </span>
          ))}
        </span>
      )}
    </>
  )
}

function Column({
  column,
  ratio,
  dimmed,
  onHover,
  register
}: {
  column: SetColumn
  ratio: number
  dimmed: boolean
  onHover: (key: string) => void
  register: (key: string, element: HTMLLIElement) => () => void
}): React.JSX.Element {
  const { key, name, value, link } = column
  const accessibleName = accessibleNameOf(column)

  function handleMouseEnter(): void {
    onHover(key)
  }

  function columnRef(element: HTMLLIElement): () => void {
    return register(key, element)
  }

  const body = (
    <>
      <span className="flex min-h-[200px] w-full grow items-end">
        {value > 0 && (
          <span
            data-chart-mark=""
            className="relative block h-(--bar-height) min-h-[2px] w-full"
            style={{ '--bar-height': `${ratio * 100}%` }}
          >
            <span
              className={`absolute inset-0 rounded-t-[3px] bg-chart-1 transition-opacity ${dimmed ? 'opacity-30' : ''}`}
            />
          </span>
        )}
      </span>
      <span className="h-[14px] max-w-full truncate text-2xs leading-[14px] text-fg-subtle">
        {name}
      </span>
    </>
  )

  return (
    <li
      ref={columnRef}
      data-chart-item=""
      onMouseEnter={handleMouseEnter}
      className="flex min-w-0 grow basis-0 flex-col"
    >
      {link !== undefined ? (
        <Link {...link} aria-label={accessibleName} className={COLUMN_BODY_CLASS}>
          {body}
        </Link>
      ) : (
        <span aria-label={accessibleName} className={COLUMN_BODY_CLASS}>
          {body}
        </span>
      )}
    </li>
  )
}
