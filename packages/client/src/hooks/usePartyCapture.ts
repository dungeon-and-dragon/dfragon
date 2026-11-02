import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import { useMachine } from '@xstate/react'
import {
  partyCaptureMachine,
  getCapturePhase
} from '@dfragon/client-core/lib/party-capture-machine'
import type { CapturePhase } from '@dfragon/client-core/types/capture'
import { SEARCH_SLOT_COUNTS } from '@dfragon/client-core/preload/common/types/search'
import { useCharacterSearch } from './useCharacterSearch'
import { getRecognizedNicknames } from '@dfragon/client-core/lib/recognized-nicknames'
import { useClientHost } from './useClientHost'
import { useSeatOrder, type SeatArrangement } from './useSeatOrder'
import { PARTY_SEAT_LAYOUT } from '@dfragon/client-core/constants/cards'
import {
  createSharedOcrWorker,
  type OcrRecognition
} from '@dfragon/client-core/lib/ocr-worker-recognition'
import type { CaptureTexts } from '@dfragon/client-core/lib/capture-texts'

export type CaptureSourceSelection = {
  selectedSourceId: string
  sourceReady: boolean
  selectSource: (sourceId: string) => void
}

export type PartyCapture = {
  source: CaptureSourceSelection
  search: ReturnType<typeof useCharacterSearch>
  phase: CapturePhase
  recognizing: boolean
  canStartCapture: boolean
  nicknames: (string | null)[]
  round: number
  startedRounds: number
  status: string
  lastCompletedAt: number | null
  ocrReady: boolean
  recognizeWithOcr: OcrRecognition
  startRound: () => void
  startPastedRound: () => void
  stopCapture: () => void
  seats: SeatArrangement
}

/**
 * 회차는 네 자리를 비우고 게임 화면의 파티 순서대로 1~4번 자리를 채우므로 시작할 때 자리 배치를 처음으로
 * 되돌리고, 인식하는 동안에는 맞바꾸지 않는다.
 */
export function usePartyCapture({ texts }: { texts: CaptureTexts }): PartyCapture {
  const { party } = useClientHost()
  const stopRef = useRef<() => void>(() => {})
  const search = useCharacterSearch(party, () => stopRef.current())
  const [ocrWorker] = useState(() => createSharedOcrWorker(texts.ocrPrepareFailed))
  const ocrReady = useSyncExternalStore(ocrWorker.subscribe, ocrWorker.isReady)
  const { seatOrder, swapSeats, resetSeats } = useSeatOrder(PARTY_SEAT_LAYOUT)
  const { begin: beginSearch } = search
  const beginRound = useCallback(
    (signal: AbortSignal): Promise<string | null> => {
      resetSeats()

      return beginSearch(signal)
    },
    [beginSearch, resetSeats]
  )

  // actor 자체가 멈추기 전에 대기 중인 공개 명령의 완료도 알린다.
  useEffect(() => () => stopRef.current(), [])
  const [snapshot, send] = useMachine(partyCaptureMachine, {
    input: {
      texts,
      selectSource: party.selectCaptureSource,
      beginSearch: beginRound,
      readFrame: party.readCaptureFrame,
      endSearch: search.end,
      observeOcr: search.observeOcr,
      recognizeWithOcr: ocrWorker.recognize
    }
  })
  const phase = getCapturePhase(snapshot)

  const startRound = useCallback(() => send({ type: 'START' }), [send])
  const startPastedRound = useCallback(() => send({ type: 'PASTE' }), [send])

  function stopCapture(): void {
    send({ type: 'STOP' })
  }
  useLayoutEffect(() => {
    stopRef.current = stopCapture
  })

  function selectSource(sourceId: string): void {
    send({ type: 'SELECT', sourceId })
  }

  const recognizing = phase === 'recognizing'
  const canMoveSeats = !recognizing
  const nicknames = getRecognizedNicknames(snapshot.context.results, SEARCH_SLOT_COUNTS.party)
  const selectedSourceId = snapshot.context.selectedSourceId
  const canStartCapture = snapshot.can({ type: 'START' })
  // 붙여 넣은 회차는 창 없이 capturing에 들어가므로, 창 등록은 고른 창이 있을 때만으로 본다.
  const sourceReady =
    selectedSourceId.length > 0 &&
    (snapshot.matches('selected') ||
      snapshot.matches('capturing') ||
      snapshot.matches('captureFailed'))

  // 등록한 창에서 첫 회차가 모델 로드를 기다리지 않도록 미리 띄우고, 창 변경, 중지 때 정리한다.
  useEffect(() => {
    if (!sourceReady) {
      return
    }
    ocrWorker.prepare()

    return () => ocrWorker.release()
  }, [ocrWorker, sourceReady])
  // 붙여 넣은 회차는 창 등록 없이 worker를 띄우므로 화면이 사라질 때 따로 정리한다.
  useEffect(() => () => ocrWorker.release(), [ocrWorker])

  const source: CaptureSourceSelection = {
    selectedSourceId,
    sourceReady,
    selectSource
  }

  return {
    source,
    phase,
    recognizing,
    canStartCapture,
    search,
    nicknames,
    round: snapshot.context.round,
    startedRounds: snapshot.context.startedRounds,
    status: snapshot.context.status,
    lastCompletedAt: snapshot.context.completedAt,
    ocrReady,
    recognizeWithOcr: ocrWorker.recognize,
    startRound,
    startPastedRound,
    stopCapture,
    seats: {
      layout: PARTY_SEAT_LAYOUT,
      seatOrder,
      canMoveSeats,
      swapSeats: (from, to) => canMoveSeats && swapSeats(from, to)
    }
  }
}
