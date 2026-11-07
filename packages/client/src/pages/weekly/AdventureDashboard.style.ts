import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const HERO_MIN_HEIGHT = 220
const TIMELINE_HEIGHT = 52

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 }
})

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
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: colors.bgBar,
    backgroundSize: 'cover',
    backgroundPosition: 'center 30%'
  },
  backdropImage: (url: string) => ({ backgroundImage: `url("${url}")` }),
  fading: {
    animationName: { default: fadeIn, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: '0.45s',
    animationTimingFunction: 'ease'
  },
  shade: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${colors.bgCanvas} 94%, transparent) 0%, color-mix(in srgb, ${colors.bgCanvas} 72%, transparent) 42%, color-mix(in srgb, ${colors.bgCanvas} 45%, transparent) 100%), linear-gradient(180deg, transparent 55%, color-mix(in srgb, ${colors.bgCanvas} 90%, transparent) 100%)`
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
