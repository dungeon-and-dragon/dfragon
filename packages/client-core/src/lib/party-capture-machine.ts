import { assign, fromCallback, fromPromise, setup, type SnapshotFrom } from 'xstate'
import type { CapturePhase } from '../types/capture'
import type { CharacterImage } from '../preload/common/types/character'
import {
  beginCaptureSearch,
  getCapturingPhase,
  getObservedNickname,
  getRecognizeErrorStatus
} from './capture-round'
import type { OcrCaptureObservation } from './capture-search'
import type { CaptureTexts } from './capture-texts'
import type { OcrRecognition } from './ocr-worker-recognition'
import { recognizePartyFrame, type PartySlotRecognition } from './party-recognition'
import { reportRendererDiagnostic, showRejectedOcrNickname } from './runtime-diagnostics'

type CaptureInput = {
  texts: CaptureTexts
  selectSource: (sourceId: string) => Promise<unknown>
  beginSearch: (signal: AbortSignal) => Promise<string | null>
  endSearch: () => void
  readFrame: (captureId: string) => Promise<CharacterImage>
  observeOcr: (input: OcrCaptureObservation) => void
  recognizeWithOcr: OcrRecognition
}

type CaptureContext = {
  effects: CaptureInput
  selectedSourceId: string
  captureId: string | null
  frame: CharacterImage | null
  results: PartySlotRecognition[]
  round: number
  startedRounds: number
  status: string
  completedAt: number | null
}

type CaptureEvent =
  | { type: 'SELECT'; sourceId: string }
  | { type: 'START' }
  | { type: 'PASTE' }
  | { type: 'STOP' }

export const partyCaptureMachine = setup({
  types: {
    context: {} as CaptureContext,
    input: {} as CaptureInput,
    events: {} as CaptureEvent
  },
  actors: {
    registerSource: fromPromise(
      async ({ input }: { input: { sourceId: string; effects: CaptureInput } }) => {
        await input.effects.selectSource(input.sourceId)
      }
    ),
    beginSearch: beginCaptureSearch,
    readFrame: fromPromise(({ input }: { input: { captureId: string; effects: CaptureInput } }) =>
      input.effects.readFrame(input.captureId)
    ),
    recognize: fromPromise(
      ({
        input,
        signal
      }: {
        input: { frame: CharacterImage; effects: CaptureInput }
        signal: AbortSignal
      }) =>
        input.effects.recognizeWithOcr(
          signal,
          input.effects.texts.partyOcrFailed,
          (recognizeText) => recognizePartyFrame(input.frame, recognizeText)
        )
    ),
    lifetime: fromCallback<CaptureEvent, CaptureInput>(({ input }) => () => {
      input.endSearch()
      input.selectSource('').catch(() => undefined)
    })
  },
  actions: {
    resetSearch: ({ context }) => context.effects.endSearch(),
    // 새 회차는 이전 완료 시각을 남겨 두고, 창 변경과 중지만 카드와 함께 완료 시각을 비운다.
    clearCompletion: assign({ completedAt: null }),
    resetRecognition: assign({
      captureId: null,
      frame: null,
      results: [],
      round: ({ context }) => context.round + 1
    }),
    countStart: assign({ startedRounds: ({ context }) => context.startedRounds + 1 }),
    selectSource: assign(({ event }) => {
      if (event.type !== 'SELECT') {
        return {}
      }
      const status = event.sourceId
        ? '게임 창 선택을 확인하고 있습니다.'
        : '캡처할 게임 창을 선택해 주세요.'

      return { selectedSourceId: event.sourceId, status }
    }),
    applyRecognition: ({ context }) => {
      const { effects, frame, results } = context
      if (frame === null) {
        return
      }
      for (const result of results) {
        if (result.kind === 'missing' || result.kind === 'failed') {
          continue
        }
        const { slot, portrait } = result
        if (result.kind === 'rejected') {
          showRejectedOcrNickname(result)
        }
        const nickname = getObservedNickname(result)
        effects.observeOcr({ slot, nickname, candidateNicknames: [nickname], portrait })
      }
    }
  }
}).createMachine({
  id: 'partyCapture',
  initial: 'idle',
  context: ({ input }) => ({
    effects: input,
    selectedSourceId: '',
    captureId: null,
    frame: null,
    results: [],
    round: 0,
    startedRounds: 0,
    status: '캡처할 게임 창을 선택해 주세요.',
    completedAt: null
  }),
  invoke: { src: 'lifetime', input: ({ context }) => context.effects },
  on: {
    SELECT: {
      target: '.selecting',
      actions: ['resetSearch', 'resetRecognition', 'clearCompletion', 'selectSource']
    },
    // 붙여 넣은 프레임은 host가 들고 있다가 readFrame으로 돌려주므로 창 선택 없이 회차를 시작한다.
    PASTE: { target: '.capturing', actions: ['countStart'] },
    STOP: {
      target: '.stopped',
      actions: [
        'resetSearch',
        'resetRecognition',
        'clearCompletion',
        assign({ status: '캡처를 중지했습니다.' })
      ]
    }
  },
  states: {
    idle: {},
    selecting: {
      on: {
        SELECT: {
          target: 'selecting',
          reenter: true,
          actions: ['resetSearch', 'resetRecognition', 'clearCompletion', 'selectSource']
        }
      },
      invoke: {
        src: 'registerSource',
        input: ({ context }) => ({ sourceId: context.selectedSourceId, effects: context.effects }),
        onDone: [
          {
            guard: ({ context }) => context.selectedSourceId.length > 0,
            target: 'selected',
            actions: assign({ status: '캡처 버튼을 눌러 파티를 인식해 주세요.' })
          },
          { target: 'idle' }
        ],
        onError: {
          target: 'selectionFailed',
          actions: assign({ status: '게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.' })
        }
      }
    },
    selected: {
      on: { START: { target: 'capturing', actions: ['countStart'] } }
    },
    stopped: {},
    capturing: {
      initial: 'search',
      entry: ['resetSearch', 'resetRecognition', assign({ status: '파티를 인식하고 있습니다.' })],
      on: {
        START: { target: 'capturing', reenter: true, actions: ['countStart'] },
        PASTE: { target: 'capturing', reenter: true, actions: ['countStart'] }
      },
      states: {
        search: {
          // Main에 수명이 생긴 뒤 begin 응답이 도착할 때까지 중복 시작을 막는다.
          on: { START: {}, PASTE: {} },
          invoke: {
            src: 'beginSearch',
            input: ({ context }) => context.effects,
            onDone: {
              target: 'frame',
              actions: assign({ captureId: ({ event }) => event.output })
            },
            onError: {
              target: '#partyCapture.captureFailed',
              actions: [
                () => reportRendererDiagnostic('CAPTURE_START_FAILED'),
                assign({ status: ({ context }) => context.effects.texts.partyStartFailed })
              ]
            }
          }
        },
        frame: {
          invoke: {
            src: 'readFrame',
            // 검색 시작 actor의 성공 전이에서만 captureId가 기록된다.
            input: ({ context }) => ({ captureId: context.captureId!, effects: context.effects }),
            onDone: {
              target: 'recognizing',
              actions: assign({ frame: ({ event }) => event.output })
            },
            onError: {
              target: '#partyCapture.captureFailed',
              actions: [
                () => reportRendererDiagnostic('CAPTURE_READ_FAILED'),
                assign({ status: ({ context }) => context.effects.texts.disconnected })
              ]
            }
          }
        },
        recognizing: {
          invoke: {
            src: 'recognize',
            // frame 상태의 성공 전이에서 확보한 회차 프레임만 인식한다.
            input: ({ context }) => ({ frame: context.frame!, effects: context.effects }),
            onDone: [
              {
                guard: ({ event }) => event.output.some((result) => result.kind === 'failed'),
                target: '#partyCapture.captureFailed',
                actions: [
                  assign({ results: ({ event }) => event.output }),
                  () => reportRendererDiagnostic('OCR_FAILED'),
                  assign({ status: ({ context }) => context.effects.texts.partyOcrFailed })
                ]
              },
              {
                guard: ({ event }) => event.output.every((result) => result.kind === 'missing'),
                target: 'unavailable',
                actions: assign({
                  status: ({ context }) => context.effects.texts.partyFrameMissing
                })
              },
              {
                target: 'complete',
                actions: [assign({ results: ({ event }) => event.output }), 'applyRecognition']
              }
            ],
            onError: {
              target: '#partyCapture.captureFailed',
              actions: [
                () => reportRendererDiagnostic('OCR_FAILED'),
                assign({
                  status: ({ context, event }) =>
                    getRecognizeErrorStatus(event.error, context.effects.texts.partyOcrFailed)
                })
              ]
            }
          }
        },
        complete: {
          entry: assign({
            status: ({ context }) => context.effects.texts.complete,
            completedAt: () => Date.now()
          })
        },
        unavailable: {}
      }
    },
    selectionFailed: {},
    captureFailed: {
      entry: ['resetSearch', 'resetRecognition'],
      on: { START: { target: 'capturing', actions: ['countStart'] } }
    }
  }
})

export function getCapturePhase(snapshot: SnapshotFrom<typeof partyCaptureMachine>): CapturePhase {
  if (snapshot.matches('capturing')) {
    return getCapturingPhase(snapshot)
  }

  if (snapshot.matches('selecting')) {
    return 'selecting'
  }

  if (snapshot.matches('selected')) {
    return 'selected'
  }

  if (snapshot.matches('selectionFailed') || snapshot.matches('captureFailed')) {
    return 'failed'
  }

  return 'idle'
}
