import * as stylex from '@stylexjs/stylex'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useEffectEvent, type KeyboardEvent } from 'react'
import { GameBar } from '../../components/GameBar'
import { ScreenShareChip } from '../../components/ScreenShareChip'
import { CONTENT_WIDTH } from '../../constants/layout'
import { useScreenCaptureContext } from '../../hooks/useScreenCaptureContext'
import { useSearchModeStore } from '../../hooks/useSearchModeStore'
import type { AutoRoundSignal, BrowserHost } from '../../host/client-host'
import { SearchScreen } from '../search/SearchScreen'
import { styles } from './MultisearchPage.style'

const route = getRouteApi('/multisearch')
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

// 자리 맞바꾸기의 Alt+방향키는 브라우저의 뒤로, 앞으로 가기와 겹친다. 가장자리 자리처럼 맞바꿀 상대가 없어 카드가
// 처리하지 않은 키도 멀티서치에서는 페이지를 떠나지 않게 막는다.
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

// 표 상태는 라우터 위의 ScreenCaptureProvider와 store가 가지므로 멀티서치를 떠나며 unmount해도 남는다. 붙여넣기와
// 자동 인식 회차는 이 화면이 그려진 동안에만 구독한다.
export function MultisearchPage(): React.JSX.Element {
  const { host } = route.useRouteContext()

  return (
    <div
      onKeyDown={keepSeatMoveKeys}
      {...stylex.props(styles.page, styles.pageWidth(CONTENT_WIDTH))}
    >
      <PastedFrameRounds host={host} />
      <AutoRounds host={host} />
      <div {...stylex.props(styles.box)}>
        <GameBar />
        <SearchScreen captureSource={<ScreenShareChip host={host} />} />
      </div>
    </div>
  )
}
