import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 }
})

export const styles = stylex.create({
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
  }
})
