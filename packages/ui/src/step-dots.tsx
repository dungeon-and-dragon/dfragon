export type StepDotsProps = {
  size?: 4 | 5
}

export function StepDots({ size = 4 }: StepDotsProps) {
  return (
    <span aria-hidden="true" className={`step-dots step-dots-${size}`}>
      <span />
      <span />
      <span />
    </span>
  )
}
