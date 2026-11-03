import * as stylex from '@stylexjs/stylex'
import { LOOKUP_STEPS, type LookupStep } from '../lib/card-presentation'
import { styles } from './LookupProgress.style'

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
      {...stylex.props(styles.progress)}
    >
      <span aria-hidden="true" {...stylex.props(styles.dots)}>
        {LOOKUP_STEPS.map((name, index) => (
          <span
            key={name}
            {...stylex.props(
              styles.dot,
              index < current && styles.done,
              index === current && styles.active
            )}
          />
        ))}
      </span>
      {`${step} 중`}
    </span>
  )
}
