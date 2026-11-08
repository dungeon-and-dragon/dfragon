import { getTopBarCaptureControls } from '@dfragon/client-core/lib/capture-presentation'
import type { CaptureTexts } from '@dfragon/client-core/lib/capture-texts'
import type { CapturePhase } from '@dfragon/client-core/types/capture'
import { usePartyCapture, type PartyCapture } from './usePartyCapture'
import { useRaidCapture, type RaidCapture } from './useRaidCapture'
import { useIsRaidMode } from './useSearchModeStore'

export type ScreenCapture = {
  partyCapture: PartyCapture
  raidCapture: RaidCapture
  controls: { phase: CapturePhase; status: string }
  texts: CaptureTexts
  startPastedRound: () => void
}

export function useScreenCapture(texts: CaptureTexts): ScreenCapture {
  const isRaidMode = useIsRaidMode()
  const partyCapture = usePartyCapture({ texts })
  const raidCapture = useRaidCapture({
    sourceId: partyCapture.source.selectedSourceId,
    sourceReady: partyCapture.source.sourceReady,
    recognizeWithOcr: partyCapture.recognizeWithOcr,
    texts
  })
  const controls = getTopBarCaptureControls({
    isRaidMode,
    party: {
      phase: partyCapture.phase,
      status: partyCapture.status,
      sourceReady: partyCapture.source.sourceReady,
      selectedSourceId: partyCapture.source.selectedSourceId,
      connectionFailed: partyCapture.search.connectionFailed
    },
    raid: { phase: raidCapture.phase, status: raidCapture.status },
    ocrReady: partyCapture.ocrReady,
    texts
  })
  const startPastedRound = isRaidMode ? raidCapture.startPastedRound : partyCapture.startPastedRound

  return { partyCapture, raidCapture, controls, texts, startPastedRound }
}
