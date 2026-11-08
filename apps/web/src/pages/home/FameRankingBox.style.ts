import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  box: { alignSelf: 'center', width: 640, maxWidth: '100%' },
  state: {
    margin: 0,
    paddingBlock: space.s16,
    paddingInline: space.s16,
    fontSize: 13,
    lineHeight: '18px',
    color: colors.fgDanger
  }
})
