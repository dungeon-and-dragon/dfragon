import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    boxSizing: 'border-box',
    padding: 16,
    paddingBottom: 48
  },
  app: {
    maxWidth: '100%',
    overflowX: 'auto',
    backgroundColor: colors.bgCanvas
  },
  // 웹 앱을 받는 동안 상단 바 두 단(전역 48px, 게임 40px) 높이만 비워 둔다.
  appPending: { width: 1080, height: 88 },
  neople: {
    position: 'fixed',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    outline: { default: null, ':focus-visible': `2px solid ${colors.signal}` },
    outlineOffset: 2
  },
  neopleLogo: { display: 'block' }
})
