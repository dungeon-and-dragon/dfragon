import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  content: { flexShrink: 0, paddingBlockEnd: space.s4 },
  page: { display: 'flex', flexDirection: 'column' }
})
