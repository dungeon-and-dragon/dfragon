import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'
import { breakpoints } from './styles/breakpoints.stylex'

export const styles = stylex.create({
  site: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
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
    backgroundColor: colors.bgCanvas
  },
  // 모험단 히트맵 세로 탭은 상자 양옆에 자리가 있는 넓은 창에서 상자 밖 여백에 놓이므로, 그 화면만 잘리지 않게 스크롤을 두지 않는다.
  sideRoomScreen: { overflowX: { default: 'auto', [breakpoints.screenSideRoom]: 'visible' } },
  screenWidth: (width: number) => ({ width })
})
