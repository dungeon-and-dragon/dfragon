import { describeSchedule } from '#ops-app/format'
import { textClasses } from './panel-classes'

export function ScheduleText({
  schedule,
  stacked = false
}: {
  schedule: string | null
  stacked?: boolean
}): React.JSX.Element {
  if (schedule === null) {
    return <span className={textClasses.subtle}>수동</span>
  }
  const description = describeSchedule(schedule)
  if (description === undefined) {
    return <span className="num">{schedule}</span>
  }

  if (stacked) {
    return (
      <span className={textClasses.twoLine}>
        <span>{description}</span>
        <small className={`${textClasses.small} num`}>{schedule}</small>
      </span>
    )
  }

  return (
    <span>
      {description} <span className={`${textClasses.subtle} num`}>{schedule}</span>
    </span>
  )
}
