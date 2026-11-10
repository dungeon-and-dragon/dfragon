import * as stylex from '@stylexjs/stylex'
import { describeSchedule } from '../format'
import { textStyles } from './panel.style'

export function ScheduleText({
  schedule,
  stacked = false
}: {
  schedule: string | null
  stacked?: boolean
}): React.JSX.Element {
  if (schedule === null) {
    return <span {...stylex.props(textStyles.subtle)}>수동</span>
  }
  const description = describeSchedule(schedule)
  if (description === undefined) {
    return <span {...stylex.props(textStyles.numeric)}>{schedule}</span>
  }

  if (stacked) {
    return (
      <span {...stylex.props(textStyles.twoLine)}>
        <span>{description}</span>
        <small {...stylex.props(textStyles.small)}>{schedule}</small>
      </span>
    )
  }

  return (
    <span>
      {description} <span {...stylex.props(textStyles.subtle)}>{schedule}</span>
    </span>
  )
}
