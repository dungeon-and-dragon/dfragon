import { colors, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

const divider = {
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: colors.borderDefault
} as const

export const styles = stylex.create({
  header: {
    ...divider,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.s12,
    padding: space.s16,
    backgroundColor: colors.bgBar
  },
  title: { margin: 0, fontSize: 18, lineHeight: '24px', fontWeight: 700 },
  code: { fontSize: 12, color: colors.fgSubtle },
  actions: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.s12 },
  switchLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.s8,
    fontSize: 12,
    color: colors.fgMuted
  },
  facts: {
    ...divider,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    margin: 0
  },
  fact: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingBlock: space.s12,
    paddingInline: space.s16,
    borderRightWidth: { default: 1, ':last-child': 0 },
    borderRightStyle: 'solid',
    borderRightColor: colors.borderDefault
  },
  factLabel: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.fgSubtle },
  factValue: { margin: 0, fontVariantNumeric: 'tabular-nums' },
  active: {
    ...divider,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.s16,
    paddingBlock: space.s12,
    paddingInline: space.s16
  },
  activeMeta: {
    display: 'flex',
    gap: 20,
    color: colors.fgMuted,
    fontVariantNumeric: 'tabular-nums'
  },
  activeValue: { color: colors.fgDefault, fontWeight: 500 },
  more: { display: 'flex', justifyContent: 'center', paddingBlock: space.s12 }
})
