import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, space } from '@dfragon/ui/tokens.stylex'

const active = ':is([data-active])'

const TAB_LINE_HEIGHT = 40
const TAB_PADDING_INLINE = space.s12
// 내용이 아직 없는 탭과 받는 중, 오류 상태가 같은 높이를 차지해 상자가 접히지 않게 한다.
const TAB_PANEL_MIN_HEIGHT = 360

export const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column' },
  list: {
    position: 'relative',
    display: 'flex',
    alignItems: 'stretch',
    flexShrink: 0,
    boxSizing: 'border-box',
    height: TAB_LINE_HEIGHT,
    paddingInline: space.s4,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    margin: 0,
    paddingInline: TAB_PADDING_INLINE,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: { default: 'transparent', ':hover': colors.bgStripe },
    color: { default: colors.fgMuted, ':hover': colors.fgDefault, [active]: colors.fgDefault },
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: { default: 500, [active]: 700 },
    lineHeight: '20px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outlineOffset: -2,
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  // 전역 메뉴처럼 밑줄은 탭의 좌우 padding을 뺀 글자 폭에만 그린다.
  indicator: {
    position: 'absolute',
    bottom: -1,
    left: `calc(var(--active-tab-left) + ${TAB_PADDING_INLINE})`,
    width: `calc(var(--active-tab-width) - 2 * ${TAB_PADDING_INLINE})`,
    height: 2,
    backgroundColor: colors.signal
  },
  panel: {
    minHeight: TAB_PANEL_MIN_HEIGHT,
    outlineOffset: -2,
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` }
  },
  skeletonList: { gap: space.s24, alignItems: 'center', paddingInline: space.s16 },
  bone: {
    display: 'block',
    width: 56,
    height: 14,
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  }
})
