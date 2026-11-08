import * as stylex from '@stylexjs/stylex'
import { GRADE_RARITY_NAMES, gradeRarity } from '#core/today-grade/today-grade'
import { styles } from './TodayGrade.style'

export function TodayGrade({ grade }: { grade: number | null }): React.JSX.Element {
  if (grade == null) {
    return (
      <span
        role="img"
        aria-label="오늘 등급 정보 없음"
        {...stylex.props(styles.percent, styles.unknown)}
      >
        -%
      </span>
    )
  }
  const rarity = gradeRarity(grade)

  return (
    <span
      role="img"
      aria-label={`오늘 등급 ${grade}퍼센트, ${GRADE_RARITY_NAMES[rarity]}`}
      {...stylex.props(styles.percent, styles[rarity])}
    >
      {grade}%
    </span>
  )
}
