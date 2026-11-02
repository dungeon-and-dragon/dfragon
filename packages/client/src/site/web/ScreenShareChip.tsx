import * as stylex from '@stylexjs/stylex'
import { useEffect, useEffectEvent } from 'react'
import { shapes, StatusChip } from '@dfragon/ui'
import { HeaderTooltip } from '../../components/HeaderTooltip'
import { useScreenCaptureContext } from '../../hooks/useScreenCaptureContext'
import { useSearchModeStore } from '../../hooks/useSearchModeStore'
import { getCaptureControlState } from '@dfragon/client-core/lib/capture-presentation'
import type { CapturePhase } from '@dfragon/client-core/types/capture'
import type { SearchMode } from '@dfragon/client-core/types/search-mode'
import type { BrowserHost } from './browser-host'
import { styles } from './ScreenShareChip.style'
import { WEB_SCREEN_WATCH_TEXTS } from './web-capture-texts'

function getScreenShareStatus(
  { phase, status }: { phase: CapturePhase; status: string },
  watching: boolean,
  searchMode: SearchMode
): string {
  if (!watching) {
    return status
  }

  if (phase === 'selected') {
    return WEB_SCREEN_WATCH_TEXTS[searchMode].waiting
  }

  if (phase === 'complete') {
    return WEB_SCREEN_WATCH_TEXTS[searchMode].complete
  }

  return status
}

// getDisplayMedia는 사용자 제스처 안에서만 열리므로 클릭 처리에서 바로 요청한다.
export function ScreenShareChip({ host }: { host: BrowserHost }): React.JSX.Element {
  const { partyCapture, controls } = useScreenCaptureContext()
  const { selectSource, sourceReady } = partyCapture.source
  const searchMode = useSearchModeStore((store) => store.searchMode)
  const state = getCaptureControlState({ phase: controls.phase, connected: sourceReady })
  // 검색 연결 실패는 단계를 그대로 두고 문구만 바꾸므로 자동 인식 안내로 덮지 않는다.
  const watching = sourceReady && !partyCapture.search.connectionFailed
  const status = getScreenShareStatus(controls, watching, searchMode)
  const onShareEnded = useEffectEvent(() => selectSource(''))

  useEffect(() => host.onScreenShareEnded(onShareEnded), [host])

  async function connect(): Promise<void> {
    const sourceId = await host.requestScreenShare()
    if (sourceId !== null) {
      selectSource(sourceId)
    }
  }

  return (
    <span>
      <HeaderTooltip label={status} disabled={status.length === 0}>
        <button
          type="button"
          aria-label={`화면 공유, ${state.label}`}
          onClick={connect}
          {...stylex.props(styles.trigger)}
        >
          <StatusChip tone={state.tone} busy={state.busy} size="md">
            {state.label}
          </StatusChip>
        </button>
      </HeaderTooltip>
      <span role="status" data-capture-announcer="" {...stylex.props(shapes.srOnly)}>
        {status}
      </span>
    </span>
  )
}
