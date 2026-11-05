import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, shadow, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  positioner: { zIndex: 110, outlineStyle: 'none' },
  popup: {
    boxSizing: 'border-box',
    width: 420,
    maxHeight: 'min(480px, var(--available-height))',
    overflowY: 'auto',
    paddingBlock: space.s4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
    boxShadow: shadow.popover,
    color: colors.fgDefault,
    outlineStyle: 'none'
  },
  list: { margin: 0, padding: 0, listStyle: 'none' },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    paddingBlock: 6,
    paddingInline: space.s12,
    color: colors.fgDefault,
    textDecoration: 'none',
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.bgControl,
      ':focus-visible': colors.bgControl
    },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: -2,
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  well: {
    position: 'relative',
    flexShrink: 0,
    width: 36,
    height: 36,
    overflow: 'hidden',
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  identity: { display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px'
  },
  job: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted
  },
  server: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 20,
    paddingInline: 6,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 500
  },
  fame: {
    flexShrink: 0,
    minWidth: 64,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: '18px',
    fontVariantNumeric: 'tabular-nums',
    color: colors.gameFame
  },
  missing: { color: colors.fgDisabled },
  notice: {
    margin: 0,
    paddingBlock: space.s8,
    paddingInline: space.s12,
    fontSize: 13,
    lineHeight: '18px',
    color: colors.fgMuted
  }
})
