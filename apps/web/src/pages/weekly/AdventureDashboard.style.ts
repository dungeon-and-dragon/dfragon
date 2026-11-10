import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const HERO_MIN_HEIGHT = 220
const TIMELINE_HEIGHT = 52

export const styles = stylex.create({
  timelinePlaceholder: { height: TIMELINE_HEIGHT },
  hero: {
    position: 'relative',
    minHeight: HERO_MIN_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: space.s24,
    paddingTop: 20,
    paddingBottom: space.s16,
    paddingInline: space.s16,
    overflow: 'hidden',
    backgroundColor: colors.bgBar,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
  content: { position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 },
  bottom: {
    position: 'relative',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s16
  },
  kind: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.fgMuted },
  title: {
    margin: 0,
    fontSize: 20,
    lineHeight: '28px',
    fontWeight: 700,
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere'
  },
  nameRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.s8 },
  seasonName: { fontSize: 24, lineHeight: '30px', fontWeight: 700 },
  start: {
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted,
    fontVariantNumeric: 'tabular-nums'
  },
  state: {
    margin: 0,
    fontSize: 13,
    lineHeight: '18px',
    color: colors.fgDanger
  }
})
