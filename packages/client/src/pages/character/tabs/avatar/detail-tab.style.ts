import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  tab: { display: 'flex', flexDirection: 'column', gap: space.s24, padding: space.s16 },
  section: { display: 'flex', flexDirection: 'column', gap: space.s8, minWidth: 0 },
  heading: {
    margin: 0,
    fontSize: 13,
    lineHeight: '18px',
    fontWeight: 600,
    color: colors.fgMuted
  }
})
