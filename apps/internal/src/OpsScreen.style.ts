import { colors, font, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingBottom: 48,
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    fontFamily: font.ui,
    fontSize: 13,
    lineHeight: '18px'
  },
  main: {
    boxSizing: 'border-box',
    width: 1200,
    maxWidth: '100%',
    marginTop: space.s24,
    paddingInline: space.s16,
    display: 'flex',
    flexDirection: 'column',
    gap: space.s16
  },
  queues: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) minmax(0, 1fr)',
      '@media (max-width: 800px)': 'minmax(0, 1fr)'
    },
    gap: space.s16,
    alignItems: 'start'
  }
})
