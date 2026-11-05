import * as stylex from '@stylexjs/stylex'
import { colors, size } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 로고를 페이지 아래에 두므로 화면이 짧아도 창 높이를 채우고, 내용이 길면 로고가 내용 아래로 밀린다.
  page: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    boxSizing: 'border-box',
    paddingBottom: 64
  },
  // 웹 앱을 받는 동안 전역 바 높이와 테두리만 비워 둔다.
  appPending: {
    flexShrink: 0,
    height: size.topbar,
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  neople: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    outlineOffset: 2
  },
  neopleLogo: { display: 'block' }
})
