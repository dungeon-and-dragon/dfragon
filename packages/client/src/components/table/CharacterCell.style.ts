import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const PORTRAIT_WIDTH = 40
const PORTRAIT_HEIGHT = 48

export const styles = stylex.create({
  cell: { display: 'flex', alignItems: 'center', gap: space.s12, minWidth: 0 },
  well: {
    position: 'relative',
    flexShrink: 0,
    width: PORTRAIT_WIDTH,
    height: PORTRAIT_HEIGHT,
    overflow: 'hidden',
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  identity: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  line: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  server: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 18,
    paddingInline: 6,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 500
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 700,
    color: colors.fgDefault,
    textDecoration: { default: 'none', ':hover': 'underline' }
  },
  adventure: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted,
    textDecoration: { default: 'none', ':hover': 'underline' }
  },
  job: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgSubtle
  },
  detail: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgSubtle,
    fontVariantNumeric: 'tabular-nums'
  }
})
