import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const SPLIT_LABEL_WIDTH = 72

export const styles = stylex.create({
  head: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.s24,
    paddingBlock: space.s8,
    paddingInline: space.s16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBar
  },
  headName: { display: 'flex', flexDirection: 'column', gap: 2 },
  headKind: {
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    color: colors.fgMuted,
    fontVariantNumeric: 'tabular-nums'
  },
  headTitle: { margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 700 },
  figures: { display: 'flex', gap: space.s24, margin: 0, marginLeft: 'auto' },
  figure: { display: 'flex', flexDirection: 'column', gap: 2 },
  figureLabel: { fontSize: 11, lineHeight: '14px', fontWeight: 500, color: colors.fgSubtle },
  figureValue: {
    margin: 0,
    fontSize: 20,
    lineHeight: '24px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  },
  up: { color: colors.chart1 },
  down: { color: colors.chart8 },
  splitBody: { display: 'flex', flexDirection: 'column', gap: space.s12, padding: space.s16 },
  splitFigures: { display: 'flex', gap: space.s24, margin: 0 },
  splitRows: { display: 'flex', flexDirection: 'column', gap: space.s8, marginTop: 'auto' },
  splitRow: {
    display: 'grid',
    gridTemplateColumns: `${SPLIT_LABEL_WIDTH}px minmax(0, 1fr)`,
    alignItems: 'center',
    columnGap: space.s12
  },
  splitLabel: { display: 'flex', flexDirection: 'column' },
  splitWeek: { fontSize: 11, lineHeight: '14px', color: colors.fgSubtle },
  splitTotal: { fontSize: 13, lineHeight: '18px', fontVariantNumeric: 'tabular-nums' }
})
