import { PRODUCT_NAME } from '@dfragon/lib'
import { Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { GRADE_RARITY_NAMES, gradeRarity } from '@dfragon/client-core/lib/today-grade'
import { styles } from './TopBar.style'

function GradePercent({ percent }: { percent: number | null }): React.JSX.Element {
  if (percent == null) {
    return (
      <Typo.txtM
        as="span"
        role="img"
        aria-label="등급 정보 없음"
        weight={700}
        {...stylex.props(styles.percent, styles.unknown)}
      >
        -%
      </Typo.txtM>
    )
  }
  const rarity = gradeRarity(percent)

  return (
    <Typo.txtM
      as="span"
      role="img"
      aria-label={`등급 ${percent}퍼센트, ${GRADE_RARITY_NAMES[rarity]}`}
      weight={700}
      {...stylex.props(styles.percent, styles[rarity])}
    >
      {percent}%
    </Typo.txtM>
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
          <GradePercent percent={grade} />
          <Typo.caption as="span" weight={700} {...stylex.props(styles.name)}>
            {PRODUCT_NAME}
          </Typo.caption>
        </div>
        <span {...stylex.props(styles.status)}>{status}</span>
      </div>
      <div {...stylex.props(styles.gameBar)}>
        {nav}
        {board}
      </div>
    </header>
  )
}
