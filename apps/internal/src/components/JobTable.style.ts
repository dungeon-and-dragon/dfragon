import { colors } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  name: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.fgDefault,
    font: 'inherit',
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    textDecoration: { default: 'none', ':hover': 'underline' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  }
})
