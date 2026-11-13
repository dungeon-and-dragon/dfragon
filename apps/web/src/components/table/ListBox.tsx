import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { styles } from './ListBox.style'

export function ListBox({
  name,
  fillHeight = false,
  children
}: {
  name: string
  fillHeight?: boolean
  children?: ReactNode
}): React.JSX.Element {
  return (
    <section aria-label={name} {...stylex.props(styles.box, fillHeight && styles.fillHeight)}>
      <h2 {...stylex.props(styles.name, children != null && styles.divider)}>{name}</h2>
      {children}
    </section>
  )
}
