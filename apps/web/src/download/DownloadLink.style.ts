import * as stylex from '@stylexjs/stylex'
import { siteColors, siteFonts } from '../theme.stylex'

export const styles = stylex.create({
  button: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 10,
    boxSizing: 'border-box',
    height: 48,
    paddingInline: 22,
    backgroundColor: { default: siteColors.surface, ':hover': siteColors.line },
    color: siteColors.ink,
    border: `2px solid ${siteColors.ink}`,
    boxShadow: `4px 4px 0 ${siteColors.accent}`,
    fontFamily: siteFonts.body,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: '22px',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    outline: { default: null, ':focus-visible': `3px solid ${siteColors.ink}` },
    outlineOffset: 2
  }
})
