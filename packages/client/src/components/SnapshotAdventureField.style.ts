import * as stylex from '@stylexjs/stylex'
import { colors, radius } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  field: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 130,
    height: 24,
    margin: 0,
    paddingBlock: 0,
    paddingInline: 6,
    borderWidth: 1,
    borderStyle: { default: 'dashed', ':focus': 'solid' },
    borderColor: { default: colors.borderStrong, ':focus': colors.signal },
    borderRadius: radius.control,
    backgroundColor: colors.bgCanvas,
    color: colors.fgAdventure,
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: '18px',
    outlineStyle: 'none',
    '::placeholder': { color: colors.fgSubtle }
  }
})
