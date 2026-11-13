import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  box: {
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault
  },
  fillHeight: { display: 'flex', flexDirection: 'column' },
  name: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    margin: 0,
    paddingInline: space.s16,
    backgroundColor: colors.bgBar,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 700
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  }
})
