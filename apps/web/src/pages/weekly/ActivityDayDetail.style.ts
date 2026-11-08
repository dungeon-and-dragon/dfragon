import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const DETAIL_WIDTH = 256
const TIME_WIDTH = 34
const BONE_HEIGHT = 48

export const styles = stylex.create({
  detail: { display: 'flex', flexDirection: 'column', width: DETAIL_WIDTH },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: space.s16,
    paddingBottom: 6,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    fontSize: 12,
    lineHeight: '16px',
    color: colors.fgMuted
  },
  date: { color: colors.fgDefault, fontVariantNumeric: 'tabular-nums' },
  group: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: space.s16,
    paddingTop: 6,
    paddingBottom: 2,
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: 500,
    color: colors.fgSubtle
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: space.s16,
    paddingBlock: 3,
    fontSize: 12,
    lineHeight: '16px'
  },
  timelineRow: { justifyContent: 'flex-start', gap: space.s8 },
  text: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  number: { fontVariantNumeric: 'tabular-nums' },
  muted: { color: colors.fgMuted },
  time: { flexShrink: 0, width: TIME_WIDTH, color: colors.fgSubtle },
  target: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  success: { color: colors.fgSuccess },
  failure: { color: colors.fgDanger },
  legendary: { color: colors.rarityLegendary },
  epic: { color: colors.rarityEpic },
  primordial: {
    color: 'transparent',
    backgroundImage: colors.rarityPrimordialGradient,
    backgroundClip: 'text'
  },
  mythic: {
    color: 'transparent',
    backgroundImage: colors.rarityMythicGradient,
    backgroundClip: 'text'
  },
  reinforce: { color: colors.gameEnhance },
  amplify: { color: colors.gameAmplify },
  refine: { color: colors.gameRefine },
  bone: {
    display: 'block',
    height: BONE_HEIGHT,
    marginBlock: space.s4,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl
  }
})
