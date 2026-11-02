import type { CapturePhase } from '../types/capture'
import type { CaptureTexts } from './capture-texts'

type CaptureControlInput = {
  phase: CapturePhase
  connected: boolean
}

type CaptureStatus = { phase: CapturePhase; status: string }

export type CaptureControlTone = 'neutral' | 'success' | 'danger' | 'warning' | 'signal'

export function getCaptureControlState({ phase, connected }: CaptureControlInput): {
  label: string
  tone: CaptureControlTone
  busy: boolean
} {
  if (phase === 'selecting') {
    return { label: '준비 중', tone: 'neutral', busy: false }
  }

  if (phase === 'recognizing') {
    return { label: '인식 중', tone: 'signal', busy: true }
  }

  if (phase === 'complete') {
    return { label: '인식 완료', tone: 'signal', busy: false }
  }

  if (phase === 'unavailable') {
    return { label: '확인 필요', tone: 'warning', busy: false }
  }

  if (phase === 'failed') {
    return { label: '캡처 실패', tone: 'danger', busy: false }
  }

  if (connected) {
    return { label: '게임 연결됨', tone: 'success', busy: false }
  }

  return { label: '게임 연결', tone: 'warning', busy: false }
}

function getRaidScreenCapture({
  party,
  raid
}: {
  party: CaptureStatus & { sourceReady: boolean; selectedSourceId: string }
  raid: CaptureStatus
}): CaptureStatus {
  // 창을 고른 Desktop은 창 변경, 중지, 등록 실패를 공대 회차보다 먼저 알린다. 창 없이 붙여 넣은 회차만 공대 단계를 보인다.
  const partyStatusFirst =
    !party.sourceReady && (party.selectedSourceId !== '' || raid.phase === 'idle')
  if (partyStatusFirst) {
    return { phase: party.phase, status: party.status }
  }

  if (raid.phase === 'idle') {
    return { phase: 'selected', status: raid.status }
  }

  return { phase: raid.phase, status: raid.status }
}

export function getTopBarCaptureControls({
  isRaidMode,
  party,
  raid,
  ocrReady,
  texts
}: {
  isRaidMode: boolean
  party: CaptureStatus & {
    sourceReady: boolean
    selectedSourceId: string
    connectionFailed: boolean
  }
  raid: CaptureStatus
  ocrReady: boolean
  texts: Pick<CaptureTexts, 'noSource' | 'ocrPreparing'>
}): CaptureStatus {
  const screenCapture = isRaidMode
    ? getRaidScreenCapture({ party, raid })
    : { phase: party.phase, status: party.status }

  if (party.connectionFailed) {
    return {
      phase: screenCapture.phase,
      status: '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    }
  }

  if (!party.selectedSourceId && screenCapture.phase === 'idle') {
    return { phase: screenCapture.phase, status: texts.noSource }
  }

  if (screenCapture.phase === 'recognizing' && !ocrReady && texts.ocrPreparing !== null) {
    return { phase: screenCapture.phase, status: texts.ocrPreparing }
  }

  return screenCapture
}
