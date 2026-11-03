import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, size } from '@dfragon/ui/tokens.stylex'

const pressed = ':is([aria-pressed="true"])'

export const toolStyles = stylex.create({
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: size.controlSm,
    height: size.controlSm,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    borderRadius: radius.control,
    backgroundColor: {
      default: 'transparent',
      ':hover:not(:disabled, [aria-pressed="true"])': colors.bgControlHover,
      [pressed]: `color-mix(in srgb, ${colors.signal} 14%, transparent)`
    },
    boxShadow: { default: null, [pressed]: `inset 0 0 0 1px ${colors.signal}` },
    color: {
      default: colors.fgMuted,
      ':hover:not(:disabled, [aria-pressed="true"])': colors.fgDefault,
      ':disabled': colors.fgDisabled,
      [pressed]: colors.signal
    },
    cursor: { default: 'pointer', ':disabled': 'default' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2,
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  }
})
