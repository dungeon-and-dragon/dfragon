import { rarityTextClasses } from './game-colors'
import { GRADE_RARITY_NAMES, gradeRarity } from '#core/today-grade'

const percent = 'shrink-0 num text-base font-semibold whitespace-nowrap'

export function TodayGrade({ grade }: { grade: number | null }): React.JSX.Element {
  if (grade == null) {
    return (
      <span role="img" aria-label="오늘 등급 정보 없음" className={`${percent} text-fg-muted`}>
        -%
      </span>
    )
  }
  const rarity = gradeRarity(grade)

  return (
    <span
      role="img"
      aria-label={`오늘 등급 ${grade}퍼센트, ${GRADE_RARITY_NAMES[rarity]}`}
      className={`${percent} ${rarityTextClasses[rarity]}`}
    >
      {grade}%
    </span>
  )
}
