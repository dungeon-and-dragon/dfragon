import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

const current = ':is([aria-current="page"])'

export const styles = stylex.create({
  footer: {
    marginTop: 'auto',
    paddingTop: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgSubtle
  },
  neople: {
    display: 'block',
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    outlineOffset: 2
  },
  neopleLogo: { display: 'block' },
  divider: {
    flexShrink: 0,
    width: 1,
    height: 12,
    backgroundColor: colors.borderDefault
  },
  link: {
    paddingBlock: 4,
    paddingInline: 2,
    fontWeight: { default: null, [current]: 600 },
    color: { default: colors.fgSubtle, ':hover': colors.fgDefault, [current]: colors.fgDefault },
    textDecoration: { default: 'none', ':hover': 'underline' },
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    outlineOffset: 2
  }
})
