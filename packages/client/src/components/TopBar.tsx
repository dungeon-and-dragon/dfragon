import { PRODUCT_NAME } from '@dfragon/lib'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { GRADE_RARITY_NAMES, gradeRarity } from '@dfragon/client-core/lib/today-grade'
import { styles } from './TopBar.style'

const brandIcon = new URL('../assets/dfragon-icon.png', import.meta.url).href

function GradePercent({ percent }: { percent: number | null }): React.JSX.Element {
  if (percent == null) {
    return (
      <span
        role="img"
        aria-label="등급 정보 없음"
        {...stylex.props(styles.percent, styles.unknown)}
      >
        -%
      </span>
    )
  }
  const rarity = gradeRarity(percent)

  return (
    <span
      role="img"
      aria-label={`등급 ${percent}퍼센트, ${GRADE_RARITY_NAMES[rarity]}`}
      {...stylex.props(styles.percent, styles[rarity])}
    >
      {percent}%
    </span>
  )
}

export function TopBar({
  grade,
  nav,
  board,
  status
}: {
  grade: number | null
  nav: ReactNode
  board: ReactNode
  status: ReactNode
}): React.JSX.Element {
  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.globalBar)}>
        <div {...stylex.props(styles.brand)}>
          <img src={brandIcon} alt="" width={24} height={24} {...stylex.props(styles.brandIcon)} />
          <span {...stylex.props(styles.name)}>{PRODUCT_NAME}</span>
        </div>
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
        <span {...stylex.props(styles.grade)}>
          오늘 등급
          <GradePercent percent={grade} />
        </span>
        <span {...stylex.props(styles.status)}>{status}</span>
      </div>
      <div {...stylex.props(styles.gameBar)}>
        {nav}
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
        {board}
      </div>
    </header>
  )
}
