import { Button, MonitorIcon, StatusChip } from '@dfragon/ui'
import { HeaderTooltip, tooltipTriggerClass } from '#shared/ui/HeaderTooltip'
import {
  useScreenCaptureContext,
  useSearchModeStore,
  type CapturePhase,
  getCaptureControlState,
  type SearchMode,
  type BrowserHost
} from '#features/capture-search'
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
  const sharePrompt = !sourceReady && (controls.phase === 'idle' || controls.phase === 'selected')
  // 검색 연결 실패는 단계를 그대로 두고 문구만 바꾸므로 자동 인식 안내로 덮지 않는다.
  const watching = sourceReady && !partyCapture.search.connectionFailed
  const status = getScreenShareStatus(controls, watching, searchMode)

  async function connect(): Promise<void> {
    const sourceId = await host.requestScreenShare()
    if (sourceId !== null) {
      selectSource(sourceId)
    }
  }

  // 빈 선택은 브라우저에서 공유를 멈췄을 때처럼 공유 track과 마을 자동 인식을 함께 멈춘다.
  function disconnect(): void {
    selectSource('')
  }

  return (
    // 보드 헤더 끝의 도구 간격(4px)에 더해 마지막 캡처 시각, 스냅샷과 12px씩 띄운다.
    <span className="mr-2 inline-flex">
      <HeaderTooltip label={status} disabled={status.length === 0}>
        <span className={tooltipTriggerClass}>
          {sharePrompt ? (
            <Button
              variant="primary"
              size="sm"
              aria-label={`화면 공유, ${state.label}`}
              onClick={connect}
            >
              <MonitorIcon className="size-icon-sm" />
              화면 공유
            </Button>
          ) : (
            <button
              type="button"
              aria-label={
                sourceReady ? `화면 공유 중지, ${state.label}` : `화면 공유, ${state.label}`
              }
              onClick={sourceReady ? disconnect : connect}
              className="inline-flex cursor-pointer rounded-badge focus-ring"
            >
              <StatusChip tone={state.tone} busy={state.busy} size="md">
                {state.label}
              </StatusChip>
            </button>
          )}
        </span>
      </HeaderTooltip>
    </span>
  )
}
