import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

const SCREEN_BORDER_WIDTH = 1

export const styles = stylex.create({
  site: {
    display: 'flex',
    flexDirection: 'column',
    color: colors.fgDefault,
    fontFamily: font.ui,
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere'
  },
  // 좁은 창에서는 페이지 대신 화면 상자 안에서 가로로 스크롤한다. 안의 보조 기술용 absolute 요소가 상자 밖 페이지를
  // 기준으로 놓이면 overflow에 잘리지 않고 페이지를 넓히므로 상자를 기준으로 삼는다.
  screen: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'center',
    boxSizing: 'border-box',
    maxWidth: '100%',
    marginBlockStart: space.s24,
    overflowX: 'auto',
    borderWidth: SCREEN_BORDER_WIDTH,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgCanvas
  },
  screenWidth: (width: number) => ({ width }),
  home: { display: 'flex', flexDirection: 'column' },
  homeWidth: (screenWidth: number) => ({ minWidth: screenWidth - SCREEN_BORDER_WIDTH * 2 })
})
