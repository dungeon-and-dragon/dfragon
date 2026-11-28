import { ChevronDownIcon, ChevronRightIcon } from '@dfragon/ui'
import { Link, type LinkOptions } from '@tanstack/react-router'
import { type ReactNode, useId, useRef, useState } from 'react'
import { ROW_BAR_GROW, useChartBarGrow } from './useChartBarGrow'
import { type TooltipPlace, useChartTooltipSlide } from './useChartTooltipSlide'
import { TOOLTIP_CLASS, TOOLTIP_COUNT_CLASS } from './plot-layout'
import { useChartHover } from './useChartHover'

const integer = new Intl.NumberFormat('ko-KR')

export type Bar = Readonly<{
  key: string
  name: string
  label?: ReactNode
  value: number
  share?: string
  link?: LinkOptions
  base?: boolean
  details?: BarDetails
}>

export type BarDetails = Readonly<{ bars: readonly Bar[]; max: number }>

export type BarTone = 'count' | 'fame' | 'chart-2' | 'chart-3' | 'chart-5' | 'chart-7'

const TONE_FILL: Readonly<Record<BarTone, string>> = {
  count: 'bg-chart-1',
  fame: 'bg-game-fame',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-5': 'bg-chart-5',
  'chart-7': 'bg-chart-7'
}

const TOOLTIP_GAP = 8
const TOOLTIP_INSIDE_GAP = 10
// 값 열은 Monoplex KR 14px 숫자 9자(예: 1,914,430, 약 67px)가 한 줄에 들어가는 폭이다.
const ROW_COLUMNS_CLASS = 'grid-cols-[120px_minmax(0,1fr)_80px]'
// 좁은 폭에서도 막대가 보이도록 이름 칸은 줄 폭의 40%를 넘지 않는다.
const SIZED_NAME_ROW_COLUMNS_CLASS = 'grid-cols-[min(var(--bar-name-width),40%)_minmax(0,1fr)_80px]'
const NO_BAR_NARROW_COLUMNS_CLASS = 'max-md:grid-cols-[minmax(0,1fr)_80px]'
const LINK_COLUMN_CLASS = 'grid-cols-[minmax(0,1fr)_16px]'
// 하위 막대는 펼침 단추 아래 세로 선 오른쪽으로 들여 쓰고, 이름 칸을 이만큼만 줄여 막대가 부모 막대보다 조금 안쪽에서 시작한다.
const DETAIL_NAME_SHRINK = 8
const BODY_CLASS = 'absolute inset-0 transition-opacity'
const RAIL_CLASS =
  "relative block before:absolute before:inset-x-0 before:top-1/2 before:-mt-[0.5px] before:h-px before:bg-inset before:content-['']"

function percentOf(value: number, max: number): number {
  if (max <= 0) {
    return 0
  }

  return (value / max) * 100
}

function rowTooltipPlaceOf(
  mark: HTMLElement,
  tooltip: HTMLElement,
  list: HTMLElement
): TooltipPlace {
  const listBox = list.getBoundingClientRect()
  const markBox = mark.getBoundingClientRect()
  const railBox = (mark.parentElement ?? mark).getBoundingClientRect()
  const end = markBox.right - listBox.left
  const outside = end + TOOLTIP_GAP
  const fitsOutside = outside + tooltip.offsetWidth <= railBox.right - listBox.left
  const x = fitsOutside ? outside : end - TOOLTIP_INSIDE_GAP - tooltip.offsetWidth
  const row = mark.closest('li') ?? mark
  const rowBox = row.getBoundingClientRect()
  const y = rowBox.top - listBox.top + (rowBox.height - tooltip.offsetHeight) / 2

  return { x, y }
}

function formatInteger(value: number): string {
  return integer.format(value)
}

export function RowBars({
  bars,
  tone = 'count',
  max = Math.max(0, ...bars.map(({ value }) => value)),
  formatValue,
  nameWidth,
  barFromMd = false
}: {
  bars: readonly Bar[]
  tone?: BarTone
  max?: number
  formatValue?: (value: number) => string
  nameWidth?: number
  // true면 900px 미만에서 가운데 막대를 숨기고 이름과 값만 둔다.
  barFromMd?: boolean
}): React.JSX.Element {
  const { hover, show, areaProps } = useChartHover()
  const listRef = useRef<HTMLUListElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const marksRef = useRef(new Map<string, HTMLSpanElement>())
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const hasShare = bars.some(({ share }) => share != null)
  const linked = bars.some(({ link }) => link != null)
  const toggleSlot = bars.some(({ details }) => details != null)
  const shownBar = bars.find(({ key }) => key === hover.key)
  useChartBarGrow(listRef, ROW_BAR_GROW)
  useChartTooltipSlide({
    chartRef: listRef,
    tooltipRef,
    anchorsRef: marksRef,
    shownKey: shownBar?.key,
    open: hover.open,
    bars,
    placeOf: rowTooltipPlaceOf
  })

  function toggleDetails(key: string): void {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(key)) {
        next.add(key)
      }

      return next
    })
  }

  function columnsOf(shrink: number): Pick<RowLayout, 'columns' | 'style' | 'barFromMd'> {
    const narrow = barFromMd ? ` ${NO_BAR_NARROW_COLUMNS_CLASS}` : ''

    if (nameWidth === undefined) {
      const columns = `${ROW_COLUMNS_CLASS}${narrow}`

      return { columns, barFromMd }
    }

    const width = `${nameWidth - shrink}px`
    const columns = `${SIZED_NAME_ROW_COLUMNS_CLASS}${narrow}`

    return {
      columns,
      style: { '--bar-name-width': width },
      barFromMd
    }
  }

  function registerMark(key: string, element: HTMLSpanElement): () => void {
    marksRef.current.set(key, element)

    return () => {
      marksRef.current.delete(key)
    }
  }

  return (
    <div className="relative">
      <ul ref={listRef} {...areaProps} className="m-0 list-none p-4">
        {bars.map((bar) => {
          const open = !collapsed.has(bar.key)
          const rowColumns = columnsOf(0)
          const layout: RowLayout = {
            ...rowColumns,
            tone,
            formatValue: formatValue ?? formatInteger,
            countUp: formatValue === undefined,
            linked,
            toggleSlot
          }

          return (
            <BarRow
              key={bar.key}
              bar={bar}
              layout={layout}
              percent={percentOf(bar.value, max)}
              dimmed={hover.open && bar.key !== hover.key}
              onHover={show}
              register={registerMark}
              toggle={bar.details !== undefined ? { open, onToggle: toggleDetails } : undefined}
            >
              {bar.details !== undefined && open && (
                <ul className="m-0 ml-[7px] list-none border-l border-line p-0 pl-[41px]">
                  {bar.details.bars.map((detail) => {
                    const detailColumns = columnsOf(DETAIL_NAME_SHRINK)
                    const detailLinked =
                      bar.details?.bars.some((item) => item.link != null) ?? false
                    const detailLayout: RowLayout = {
                      ...layout,
                      ...detailColumns,
                      linked: detailLinked,
                      toggleSlot: false,
                      small: true
                    }

                    return (
                      <BarRow
                        key={detail.key}
                        bar={detail}
                        layout={detailLayout}
                        percent={percentOf(detail.value, bar.details?.max ?? 0)}
                        dimmed={hover.open && detail.key !== hover.key}
                        onHover={show}
                        register={registerMark}
                      />
                    )
                  })}
                </ul>
              )}
            </BarRow>
          )
        })}
      </ul>
      {hasShare && (
        <span ref={tooltipRef} aria-hidden="true" className={`${TOOLTIP_CLASS} top-0`}>
          {shownBar?.share != null && <span className={TOOLTIP_COUNT_CLASS}>{shownBar.share}</span>}
        </span>
      )}
    </div>
  )
}

type RowLayout = Readonly<{
  columns: string
  style?: React.CSSProperties
  tone: BarTone
  formatValue: (value: number) => string
  countUp: boolean
  linked: boolean
  toggleSlot: boolean
  small?: boolean
  barFromMd?: boolean
}>

function railHeightOf(small: boolean): string {
  if (small) {
    return 'h-[4px]'
  }

  return 'h-[6px]'
}

type DetailsToggle = Readonly<{ open: boolean; onToggle: (key: string) => void }>

function BarRow({
  bar: { key, name, label, value, link, base = false },
  layout: {
    columns,
    style,
    tone,
    formatValue,
    countUp,
    linked,
    toggleSlot,
    small = false,
    barFromMd = false
  },
  percent,
  dimmed,
  onHover,
  register,
  toggle,
  children
}: {
  bar: Bar
  layout: RowLayout
  percent: number
  dimmed: boolean
  onHover: (key: string) => void
  register: (key: string, element: HTMLSpanElement) => () => void
  toggle?: DetailsToggle
  children?: ReactNode
}): React.JSX.Element {
  const detailsId = useId()
  const fame = tone === 'fame'
  const fill = base ? 'bg-chart-base' : TONE_FILL[tone]

  function handleMouseEnter(): void {
    onHover(key)
  }

  function handleToggle(): void {
    toggle?.onToggle(key)
  }

  function markRef(element: HTMLSpanElement): () => void {
    return register(key, element)
  }

  const rowClass = `grid items-center gap-x-3 ${columns} ${small ? 'h-[24px] text-xs' : 'h-[28px] text-sm'}`
  const cells = (
    <>
      <span data-chart-name="" className={`truncate ${small || base ? 'text-fg-muted' : ''}`}>
        {label ?? name}
      </span>
      <span className={`${RAIL_CLASS} ${railHeightOf(small)}${barFromMd ? ' max-md:hidden' : ''}`}>
        <span
          ref={markRef}
          data-chart-mark=""
          className="absolute top-0 left-0 block h-full w-(--bar-width) min-w-[2px]"
          style={{ '--bar-width': `${percent}%` }}
        >
          <span className={`${BODY_CLASS} rounded-[3px] ${fill} ${dimmed ? 'opacity-30' : ''}`} />
        </span>
      </span>
      <span
        data-chart-count={countUp ? value : undefined}
        className={`text-right num ${fame ? 'text-game-fame' : ''} ${small ? 'text-fg-muted' : ''}`}
      >
        {formatValue(value)}
      </span>
    </>
  )

  if (!linked && !toggleSlot) {
    return (
      <li data-chart-item="" onMouseEnter={handleMouseEnter} className={rowClass} style={style}>
        {cells}
      </li>
    )
  }

  const row = (
    <span className={rowClass} style={style}>
      {cells}
    </span>
  )

  return (
    <li data-chart-item="" onMouseEnter={handleMouseEnter}>
      <div className="flex items-center gap-1">
        {toggleSlot && (
          <span className="inline-flex w-[16px] shrink-0">
            {toggle !== undefined && (
              <button
                type="button"
                aria-expanded={toggle.open}
                aria-controls={detailsId}
                aria-label={`${name} ${toggle.open ? '접기' : '펼치기'}`}
                onClick={handleToggle}
                className="inline-flex cursor-pointer border-0 bg-transparent p-0 text-fg-subtle focus-ring hover:text-fg"
              >
                {toggle.open ? (
                  <ChevronDownIcon className="size-icon-sm" />
                ) : (
                  <ChevronRightIcon className="size-icon-sm" />
                )}
              </button>
            )}
          </span>
        )}
        <div className="min-w-0 grow">
          {linked ? <LinkedRow link={link}>{row}</LinkedRow> : row}
        </div>
      </div>
      {children !== undefined && <div id={detailsId}>{children}</div>}
    </li>
  )
}

const LINKED_ROW_CLASS = `-mx-2 grid items-center gap-x-1 px-2 ${LINK_COLUMN_CLASS}`

// 링크가 없는 행도 화살표 칸을 비워 두어 값 열이 링크 있는 행과 같은 자리에 선다.
function LinkedRow({
  link,
  children
}: {
  link: LinkOptions | undefined
  children: ReactNode
}): React.JSX.Element {
  if (link === undefined) {
    return (
      <span className={LINKED_ROW_CLASS}>
        {children}
        <span />
      </span>
    )
  }

  return (
    <Link
      {...link}
      className={`${LINKED_ROW_CLASS} text-fg no-underline focus-ring-inset hover:bg-surface`}
    >
      {children}
      <ChevronRightIcon className="size-icon-sm text-fg-subtle" />
    </Link>
  )
}
