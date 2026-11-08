import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    flexShrink: 0,
    boxSizing: 'border-box',
    height: 40,
    paddingInlineStart: space.s4,
    paddingInlineEnd: space.s16,
    color: colors.fgDefault,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  divider: { flexShrink: 0, width: 1, height: 20, backgroundColor: colors.borderDefault }
})
