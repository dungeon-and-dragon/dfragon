import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  popup: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: space.s12,
    width: 220,
    paddingTop: 14,
    paddingInline: 14,
    paddingBottom: space.s12
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: space.s8 }
})
