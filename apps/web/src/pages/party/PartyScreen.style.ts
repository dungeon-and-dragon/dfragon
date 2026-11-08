import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  party: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    gap: space.s16
  }
})
