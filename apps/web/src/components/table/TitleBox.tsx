import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { styles } from './TitleBox.style'

export function TitleBox({
  title,
  children
}: {
  title: string
  children?: ReactNode
}): React.JSX.Element {
  return (
    <header {...stylex.props(styles.box)}>
      <h1 {...stylex.props(styles.title)}>{title}</h1>
      {children != null && <div {...stylex.props(styles.side)}>{children}</div>}
    </header>
  )
}

export function TitleStat({
  label,
  value
}: {
  label: string
  value: ReactNode
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.stat)}>
      <span {...stylex.props(styles.statLabel)}>{label}</span>
      <span {...stylex.props(styles.statValue)}>{value}</span>
    </div>
  )
}
