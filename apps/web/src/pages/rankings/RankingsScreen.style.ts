import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  screen: { display: 'flex', flexDirection: 'column', gap: space.s16, padding: space.s16 },
  filter: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s8,
    padding: space.s16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBar
  },
  filterRow: { display: 'flex', alignItems: 'flex-start', gap: space.s12 },
  filterLabel: {
    flexShrink: 0,
    width: 40,
    margin: 0,
    fontSize: 12,
    lineHeight: '24px',
    fontWeight: 700,
    color: colors.fgSubtle
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.s4,
    margin: 0,
    padding: 0,
    listStyle: 'none'
  },
  state: {
    margin: 0,
    paddingBlock: space.s16,
    paddingInline: space.s16,
    fontSize: 13,
    lineHeight: '18px',
    color: colors.fgDanger
  }
})
