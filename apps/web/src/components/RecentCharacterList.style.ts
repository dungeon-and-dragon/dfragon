import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, shadow, space } from '@dfragon/ui/tokens.stylex'

const REMOVE_SIZE = 24

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
    paddingInlineStart: space.s12,
    paddingInlineEnd: `calc(${space.s12} + ${space.s8} + ${REMOVE_SIZE}px)`,
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
  line: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px'
  },
  job: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted
  },
  level: {
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgSubtle,
    fontVariantNumeric: 'tabular-nums'
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
  title: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    margin: 0,
    paddingInline: space.s12,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    color: colors.fgSubtle,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  row: { position: 'relative' },
  remove: {
    position: 'absolute',
    insetInlineEnd: space.s12,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    borderRadius: radius.control,
    backgroundColor: { default: 'transparent', ':hover': colors.bgControlHover },
    color: { default: colors.fgMuted, ':hover': colors.fgDefault },
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: -2,
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  removeIcon: {
    width: 12,
    height: 12,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round'
  }
})
