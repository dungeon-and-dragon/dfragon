import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  window: {
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    fontFamily: font.ui,
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere'
  },
  windowWidth: (width: number) => ({ width })
})
