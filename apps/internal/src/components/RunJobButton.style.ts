import { colors, radius, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  popup: { width: 320 },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    paddingTop: space.s12,
    paddingInline: space.s12
  },
  label: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.fgMuted },
  note: { marginLeft: 6, fontStyle: 'normal', fontWeight: 400, color: colors.fgSubtle },
  input: {
    boxSizing: 'border-box',
    width: '100%',
    height: 32,
    paddingInline: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderInput,
    borderRadius: radius.control,
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    font: 'inherit',
    fontSize: 13,
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  },
  actions: { paddingTop: space.s16 }
})
