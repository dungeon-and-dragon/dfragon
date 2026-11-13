import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: space.s16
  },
  state: { margin: 0, fontSize: 13, lineHeight: '18px', color: colors.fgDanger }
})
