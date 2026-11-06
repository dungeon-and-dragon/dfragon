import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

const DETAIL_MIN_WIDTH = 200

export const styles = stylex.create({
  stats: { display: 'flex', gap: 32 },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    outline: { default: 'none', ':focus-visible': `2px solid ${colors.fgDefault}` },
    outlineOffset: 2
  },
  label: {
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    color: colors.fgSubtle
  },
  value: {
    fontSize: 20,
    lineHeight: '24px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    textShadow: `0 1px 8px color-mix(in srgb, ${colors.bgCanvas} 60%, transparent)`
  },
  bone: {
    display: 'block',
    width: 40,
    height: 20,
    marginBlock: 2,
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  detail: { display: 'flex', flexDirection: 'column', minWidth: DETAIL_MIN_WIDTH },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: space.s16,
    paddingBlock: 4,
    fontSize: 12,
    lineHeight: '16px'
  },
  count: { color: colors.fgMuted, fontVariantNumeric: 'tabular-nums' },
  group: {
    paddingTop: 6,
    paddingBottom: 2,
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: 500,
    color: colors.fgSubtle
  },
  divider: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
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
  amplify: { color: colors.gameAmplify },
  reinforce: { color: colors.gameEnhance }
})
