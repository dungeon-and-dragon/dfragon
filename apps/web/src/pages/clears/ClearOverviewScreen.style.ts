import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'
import { breakpoints } from '../../styles/breakpoints.stylex'

export const styles = stylex.create({
  jobLists: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(2, minmax(0, 1fr))',
      [breakpoints.screenNarrow]: 'minmax(0, 1fr)'
    },
    columnGap: space.s16
  },
  jobList: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  jobListTitle: { paddingTop: space.s16, paddingInline: space.s16 },
  jobLegend: { paddingInline: space.s16, paddingBottom: space.s16 },
  coClearHead: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingTop: space.s16,
    paddingInline: space.s16
  },
  coClearCount: {
    fontSize: 22,
    lineHeight: '28px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums'
  }
})
