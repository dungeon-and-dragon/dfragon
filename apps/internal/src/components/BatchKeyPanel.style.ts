import { colors, radius, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  addRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: space.s12,
    margin: 0,
    paddingBlock: space.s12,
    paddingInline: space.s16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  field: { display: 'flex', flexDirection: 'column', gap: space.s4 },
  labelField: { width: 200 },
  keyField: { width: 360 },
  label: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.fgMuted },
  input: {
    boxSizing: 'border-box',
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
  invalidInput: { borderColor: colors.fgDanger },
  error: { fontSize: 12, lineHeight: '16px' },
  name: { fontWeight: 600 },
  mask: { letterSpacing: '0.02em', color: colors.fgMuted, fontVariantNumeric: 'tabular-nums' },
  suffix: { fontWeight: 500, color: colors.fgDefault },
  status: { display: 'inline-flex', alignItems: 'center', gap: space.s8 },
  popup: { width: 240 }
})
