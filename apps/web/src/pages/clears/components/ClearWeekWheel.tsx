import * as stylex from '@stylexjs/stylex'
import { useEffect, useEffectEvent, useRef } from 'react'
import { type OverviewWeek, weekRangeText } from '../clear-overview'
import { styles } from './ClearWeekWheel.style'

// 트랙패드는 작은 delta를 연달아 보내므로 한 칸씩 넘기도록 모아서 센다.
const WHEEL_STEP_DELTA = 40

export function ClearWeekWheel({
  weeks,
  selected,
  onSelect
}: {
  weeks: readonly OverviewWeek[]
  selected: OverviewWeek
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
    <div ref={wheelRef} role="group" aria-label="주 선택" {...stylex.props(styles.wheel)}>
      <WheelRow week={previous} selected={false} onSelect={onSelect} />
      <WheelRow week={selected} selected onSelect={onSelect} />
      <WheelRow week={next} selected={false} onSelect={onSelect} />
    </div>
  )
}

function WheelRow({
  week,
  selected,
  onSelect
}: {
  week: OverviewWeek | undefined
  selected: boolean
  onSelect: (weekStart: string) => void
}): React.JSX.Element {
  if (week === undefined) {
    return <span aria-hidden="true" {...stylex.props(styles.empty)} />
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
      {...stylex.props(styles.row, selected && styles.selected)}
    >
      {weekRangeText(week.weekStart)}
      {!week.closed && <small {...stylex.props(styles.open)}>집계 중</small>}
    </button>
  )
}
