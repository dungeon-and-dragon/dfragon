import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  hero: {
    display: 'flex',
    justifyContent: 'center',
    paddingBlock: 56,
    paddingInline: space.s16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBar
  }
})
