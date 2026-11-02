import { fromPromise } from 'xstate'
import type { CapturePhase } from '../types/capture'
import type { FirstCandidate } from './party-recognition'

export const beginCaptureSearch = fromPromise(
  async ({
    input,
    signal
  }: {
    input: { beginSearch: (signal: AbortSignal) => Promise<string | null> }
    signal: AbortSignal
  }) => {
    const captureId = await input.beginSearch(signal)
    signal.throwIfAborted()
    if (captureId === null) {
      throw new Error('Search lifetime unavailable.')
    }

    return captureId
  }
)

export function getRecognizeErrorStatus(error: unknown, ocrFailedStatus: string): string {
  if (error instanceof Error) {
    return error.message
  }

  return ocrFailedStatus
}

export function getObservedNickname(candidate: FirstCandidate): string {
  if (candidate.kind === 'recognized') {
    return candidate.nickname
  }

  return ''
}

export function getCapturingPhase(snapshot: {
  matches(state: { capturing: 'complete' | 'unavailable' }): boolean
}): Extract<CapturePhase, 'complete' | 'unavailable' | 'recognizing'> {
  if (snapshot.matches({ capturing: 'complete' })) {
    return 'complete'
  }

  if (snapshot.matches({ capturing: 'unavailable' })) {
    return 'unavailable'
  }

  return 'recognizing'
}
