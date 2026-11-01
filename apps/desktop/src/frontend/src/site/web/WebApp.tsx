import * as stylex from '@stylexjs/stylex'
import { MAIN_WINDOW_SIZE } from '../../../../preload/common/window-chrome'
import { AppTopBar } from '../../components/AppTopBar'
import { MAIN_WINDOW_HEIGHTS } from '../../constants/main-window-heights'
import { useSearchModeStore } from '../../hooks/useSearchModeStore'
import { SearchScreen } from '../../pages/search/SearchScreen'
import { ScreenCaptureProvider } from '../../sections/ScreenCaptureProvider'
import { styles } from './WebApp.style'

// Desktop main.tsx, App.tsx의 문서 전체 드래그 차단, 글자 선택 차단, 100dvh가 사이트로 번지지 않게 창 크기 상자에만 그린다.
export function WebApp(): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)

  return (
    <ScreenCaptureProvider>
      <div
        {...stylex.props(
          styles.window,
          styles.windowSize(MAIN_WINDOW_SIZE.width, MAIN_WINDOW_HEIGHTS[searchMode])
        )}
      >
        <AppTopBar />
        <SearchScreen />
      </div>
    </ScreenCaptureProvider>
  )
}
