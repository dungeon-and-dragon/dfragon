import { LOOKUP_STEPS, type LookupStep } from '#pages/multisearch/card-presentation'

// design의 status-live keyframes가 이 점의 깜박임(불투명에서 0.35로)과 같아 그것을 쓴다.
const activeDotClass =
  'bg-signal animate-[status-live_var(--beat)_steps(1,end)_infinite] motion-reduce:animate-none'

function dotClass(index: number, current: number): string {
  if (index === current) {
    return activeDotClass
  }

  if (index < current) {
    return 'bg-signal'
  }

  return 'bg-line-strong'
}

export function LookupProgress({
  slot,
  step
}: {
  slot: number
  step: LookupStep
}): React.JSX.Element {
  const current = LOOKUP_STEPS.indexOf(step)

  return (
    <span
      role="progressbar"
      aria-label={`${slot}번 캐릭터 확인 중`}
      aria-valuemin={0}
      aria-valuemax={LOOKUP_STEPS.length}
      aria-valuenow={current}
      aria-valuetext={`${step} 중`}
      className="inline-flex items-center gap-2 text-xs text-fg-muted"
    >
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        {LOOKUP_STEPS.map((name, index) => (
          <span
            key={name}
            className={`size-[5px] shrink-0 rounded-full ${dotClass(index, current)}`}
          />
        ))}
      </span>
      {`${step} 중`}
    </span>
  )
}
