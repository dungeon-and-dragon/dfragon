import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  content: {
    flexShrink: 0,
    paddingBlock: space.s12,
    paddingInline: space.s16
  },
  page: { display: 'flex', flexDirection: 'column', gap: space.s16 }
})
