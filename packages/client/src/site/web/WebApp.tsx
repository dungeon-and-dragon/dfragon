import * as stylex from '@stylexjs/stylex'
import { useEffect, useEffectEvent, type KeyboardEvent } from 'react'
import { MAIN_WINDOW_SIZE } from '../../../../preload/common/window-chrome'
import { AppTopBar } from '../../components/AppTopBar'
import { MAIN_WINDOW_HEIGHTS } from '../../constants/main-window-heights'
import { useScreenCaptureContext } from '../../hooks/useScreenCaptureContext'
import { useSearchModeStore } from '../../hooks/useSearchModeStore'
import { SearchScreen } from '../../pages/search/SearchScreen'
import { ScreenCaptureProvider } from '../../sections/ScreenCaptureProvider'
import type { AutoRoundSignal, BrowserHost } from './browser-host'
import { ScreenShareChip } from './ScreenShareChip'
import { styles } from './WebApp.style'
import { WEB_CAPTURE_TEXTS } from './web-capture-texts'

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

// 자리 맞바꾸기의 Alt+방향키는 브라우저의 뒤로, 앞으로 가기와 겹친다. 가장자리 자리처럼 맞바꿀 상대가 없어 카드가
// 처리하지 않은 키도 앱 상자 안에서는 페이지를 떠나지 않게 막는다.
function keepSeatMoveKeys(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.altKey && ARROW_KEYS.has(event.key) && !isTextField(event.target)) {
    event.preventDefault()
  }
}

function PastedFrameRounds({ host }: { host: BrowserHost }): null {
  const { startPastedRound } = useScreenCaptureContext()
  const onPastedFrame = useEffectEvent(startPastedRound)

  useEffect(() => host.onPastedFrame(onPastedFrame), [host])

  return null
}

// 자동 인식은 웹의 화면을 바꾸지 않는다. 신호를 보낸 뒤 사용자가 화면을 바꿨거나 회차가 진행 중이면 시작하지 않는다.
function AutoRounds({ host }: { host: BrowserHost }): null {
  const { partyCapture, raidCapture, startPastedRound } = useScreenCaptureContext()
  const kind = useSearchModeStore((state) => state.searchMode)
  const phase = kind === 'party' ? partyCapture.phase : raidCapture.phase
  const roundRunning = phase === 'recognizing'
  const onAutoRound = useEffectEvent((signal: AutoRoundSignal): boolean => {
    if (signal.kind !== kind || roundRunning) {
      return false
    }
    startPastedRound()

    return true
  })

  useEffect(() => host.setWatchedScreen({ kind, roundRunning }), [host, kind, roundRunning])
  useEffect(() => host.onAutoRound(onAutoRound), [host])

  return null
}

// Desktop main.tsx, App.tsx의 문서 전체 드래그 차단, 글자 선택 차단, 100dvh가 사이트로 번지지 않게 창 크기 상자에만 그린다.
export function WebApp({ host }: { host: BrowserHost }): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)

  return (
    <ScreenCaptureProvider texts={WEB_CAPTURE_TEXTS}>
      <PastedFrameRounds host={host} />
      <AutoRounds host={host} />
      <div
        onKeyDown={keepSeatMoveKeys}
        {...stylex.props(
          styles.window,
          styles.windowSize(MAIN_WINDOW_SIZE.width, MAIN_WINDOW_HEIGHTS[searchMode])
        )}
      >
        <AppTopBar captureControls={<ScreenShareChip host={host} />} />
        <SearchScreen />
      </div>
    </ScreenCaptureProvider>
  )
}
