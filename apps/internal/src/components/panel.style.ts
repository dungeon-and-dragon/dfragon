import { colors, motion, radius, shadow, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const panelStyles = stylex.create({
  box: {
    position: 'relative',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgCanvas
  },
  heading: {
    margin: 0,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    paddingInline: space.s16,
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 700
  },
  headingCount: { color: colors.fgSubtle, fontWeight: 500, fontSize: 12 },
  headingActions: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.s8 },
  sectionHeading: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    paddingInline: space.s16,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    color: colors.fgSubtle,
    backgroundColor: colors.bgInset,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  empty: {
    margin: 0,
    paddingBlock: 48,
    paddingInline: space.s16,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 600
  },
  scroll: { overflowX: 'auto' }
})

export const tableStyles = stylex.create({
  table: { borderCollapse: 'collapse', width: '100%' },
  headerCell: {
    height: 32,
    paddingBlock: 0,
    paddingInline: 10,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    fontWeight: 500,
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgSubtle,
    backgroundColor: colors.bgInset,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  row: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    backgroundColor: { default: null, ':hover': colors.bgSurface },
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  tallRow: { height: 56 },
  selectedRow: { backgroundColor: colors.bgSurface },
  cell: { paddingBlock: 6, paddingInline: 10, verticalAlign: 'middle', whiteSpace: 'nowrap' },
  end: { textAlign: 'right' },
  numeric: { fontVariantNumeric: 'tabular-nums' }
})

export const textStyles = stylex.create({
  muted: { color: colors.fgMuted },
  subtle: { color: colors.fgSubtle },
  numeric: { fontVariantNumeric: 'tabular-nums' },
  twoLine: { display: 'flex', flexDirection: 'column' },
  small: { fontSize: 11, lineHeight: '14px', color: colors.fgSubtle },
  error: { margin: 0, fontSize: 13, lineHeight: '18px', color: colors.fgDanger },
  inline: { display: 'inline-flex', alignItems: 'center', gap: space.s8 }
})

export const popoverStyles = stylex.create({
  positioner: { zIndex: 10, outlineStyle: 'none' },
  popup: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: radius.panel,
    boxShadow: shadow.popover,
    color: colors.fgDefault,
    outlineStyle: 'none',
    textAlign: 'left',
    whiteSpace: 'normal'
  },
  title: {
    margin: 0,
    paddingTop: space.s12,
    paddingInline: space.s12,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 700
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: space.s8, padding: space.s12 }
})
