import * as stylex from '@stylexjs/stylex'
import { colors, radius, shadow, space } from '@dfragon/ui/tokens.stylex'

const NAV_SIZE = 32
const CALENDAR_WIDTH = 296
const WEEK_NUMBER_WIDTH = 28
const DAY_HEIGHT = 32

export const styles = stylex.create({
  picker: { display: 'flex', alignItems: 'center', gap: space.s8 },
  live: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 18,
    paddingInline: 6,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 500
  },
  nav: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: NAV_SIZE,
    height: NAV_SIZE,
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: colors.borderInput, ':disabled': colors.borderDefault },
    borderRadius: radius.control,
    backgroundColor: { default: colors.bgCanvas, ':hover:not(:disabled)': colors.bgControl },
    color: { default: colors.fgMuted, ':disabled': colors.fgDisabled },
    cursor: { default: 'pointer', ':disabled': 'default' }
  },
  navSmall: { width: 28, height: 28 },
  chevronLeft: { width: 14, height: 14, transform: 'rotate(90deg)' },
  chevronRight: { width: 14, height: 14, transform: 'rotate(-90deg)' },
  chevronDown: { width: 12, height: 12, color: colors.fgSubtle },
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: NAV_SIZE,
    paddingInline: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderInput,
    borderRadius: radius.control,
    backgroundColor: { default: colors.bgCanvas, ':hover': colors.bgControl },
    color: colors.fgDefault,
    fontFamily: 'inherit',
    fontSize: 13,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer'
  },
  positioner: { zIndex: 110, outlineStyle: 'none' },
  popup: {
    boxSizing: 'border-box',
    width: CALENDAR_WIDTH,
    padding: space.s12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    backgroundColor: colors.bgSurface,
    boxShadow: shadow.popover,
    color: colors.fgDefault,
    outlineStyle: 'none'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.s8
  },
  month: { margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 700 },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 2px',
    tableLayout: 'fixed'
  },
  weekday: {
    height: 24,
    padding: 0,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: 500,
    color: colors.fgSubtle
  },
  weekNumberHead: { width: WEEK_NUMBER_WIDTH },
  weekNumber: {
    padding: 0,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: '14px',
    color: colors.fgSubtle,
    fontVariantNumeric: 'tabular-nums'
  },
  dayCell: { padding: 0 },
  day: {
    width: '100%',
    height: DAY_HEIGHT,
    padding: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: { default: colors.fgDefault, ':disabled': colors.fgDisabled },
    fontFamily: 'inherit',
    fontSize: 12,
    lineHeight: '16px',
    fontVariantNumeric: 'tabular-nums',
    cursor: { default: 'pointer', ':disabled': 'default' }
  },
  outside: { color: colors.fgSubtle },
  hoverRow: { backgroundColor: colors.bgControl },
  selected: { backgroundColor: colors.signal, color: colors.onSignal, fontWeight: 600 },
  selectedOutside: { color: colors.fgDisabled },
  today: { boxShadow: `inset 0 -2px 0 ${colors.accent}` }
})
