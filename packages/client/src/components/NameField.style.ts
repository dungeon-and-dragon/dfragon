import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from '@dfragon/ui/tokens.stylex'

// 칸의 테두리 1과 안쪽 여백 5만큼 왼쪽으로 내밀어 이름 글자가 칸이 없는 글자와 같은 세로줄에 오게 한다.
const TEXT_INSET = 6

export const styles = stylex.create({
  name: {
    boxSizing: 'border-box',
    flex: '1 1 0',
    minWidth: 0,
    height: 24,
    margin: 0,
    marginInlineStart: -TEXT_INSET,
    paddingBlock: 0,
    paddingInline: TEXT_INSET - 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: radius.control,
    borderColor: {
      default: 'transparent',
      ':hover': colors.borderStrong,
      ':focus': colors.signal
    },
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.bgCanvas,
      ':focus': colors.bgCanvas
    },
    boxShadow: { default: null, ':focus': `0 0 0 1px ${colors.signal}` },
    color: colors.fgDefault,
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: '18px',
    fontWeight: 700,
    outlineStyle: 'none',
    textOverflow: 'ellipsis',
    transitionProperty: 'border-color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    '::placeholder': { color: colors.fgSubtle, fontWeight: 500 }
  },
  vacant: {
    borderColor: { default: colors.borderStrong, ':focus': colors.signal },
    backgroundColor: colors.bgCanvas
  }
})
