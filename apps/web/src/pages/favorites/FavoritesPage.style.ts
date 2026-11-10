import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  empty: {
    margin: 0,
    paddingBlock: 48,
    paddingInline: space.s16,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 700,
    color: colors.fgDefault
  }
})
