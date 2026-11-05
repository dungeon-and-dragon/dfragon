import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 }
})
