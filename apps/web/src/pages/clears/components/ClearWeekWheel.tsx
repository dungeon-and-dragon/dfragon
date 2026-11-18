import { useEffect, useEffectEvent, useRef } from 'react'
import { type OverviewWeek, weekRangeText } from '../clear-overview'

// 트랙패드는 작은 delta를 연달아 보내므로 한 칸씩 넘기도록 모아서 센다.
const WHEEL_STEP_DELTA = 40

const ROW = 'flex items-center justify-center gap-2 tabular-nums transition-colors focus-ring'
const ROW_IDLE = 'h-[28px] cursor-pointer text-sm text-fg-subtle hover:text-fg'
const ROW_SELECTED =
  'h-[34px] cursor-default border-x-0 border-y border-line-input text-base font-semibold text-fg'

export function ClearWeekWheel({
  weeks,
  selected,
  labelOf = weekRangeText,
  onSelect
}: {
  weeks: readonly OverviewWeek[]
  selected: OverviewWeek
  labelOf?: (weekStart: string) => string
  onSelect: (weekStart: string) => void
}): React.JSX.Element {
  const wheelRef = useRef<HTMLDivElement>(null)
  const index = weeks.findIndex(({ weekStart }) => weekStart === selected.weekStart)
  const previous = weeks[index - 1]
  const next = weeks[index + 1]
  const step = useEffectEvent((forward: boolean) => {
    const target = forward ? next : previous
    if (target !== undefined) {
      onSelect(target.weekStart)
    }
  })

  // React의 wheel 이벤트는 passive라 화면 스크롤을 막지 못해 직접 붙인다.
  useEffect(() => {
    const wheel = wheelRef.current
    if (wheel == null) {
      return
    }

    let delta = 0
    function handleWheel(event: WheelEvent): void {
      event.preventDefault()
      delta += event.deltaY
      if (Math.abs(delta) < WHEEL_STEP_DELTA) {
        return
      }

      step(delta > 0)
      delta = 0
    }

    wheel.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      wheel.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return (
    <div
      ref={wheelRef}
      role="group"
      aria-label="주 선택"
      className="flex w-[184px] shrink-0 flex-col"
    >
      <WheelRow week={previous} selected={false} labelOf={labelOf} onSelect={onSelect} />
      <WheelRow week={selected} selected labelOf={labelOf} onSelect={onSelect} />
      <WheelRow week={next} selected={false} labelOf={labelOf} onSelect={onSelect} />
    </div>
  )
}

function WheelRow({
  week,
  selected,
  labelOf,
  onSelect
}: {
  week: OverviewWeek | undefined
  selected: boolean
  labelOf: (weekStart: string) => string
  onSelect: (weekStart: string) => void
}): React.JSX.Element {
  if (week === undefined) {
    return <span aria-hidden="true" className="h-[28px]" />
  }

  function select(): void {
    if (week !== undefined && !selected) {
      onSelect(week.weekStart)
    }
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={select}
      className={`${ROW} ${selected ? ROW_SELECTED : ROW_IDLE}`}
    >
      {labelOf(week.weekStart)}
      {!week.closed && <small className="badge bg-inset text-fg-muted">집계 중</small>}
    </button>
  )
}
