import { assign, fromPromise, setup, type SnapshotFrom } from 'xstate'
import type { CapturePhase } from '../types/capture'
import type { RaidFrameResult, RaidFrameRow } from '../preload/common/types/capture'
import type { RaidValueColumn } from '../preload/common/types/search'
import {
  beginCaptureSearch,
  getCapturingPhase,
  getObservedNickname,
  getRecognizeErrorStatus
} from './capture-round'
import type { OcrCaptureObservation } from './capture-search'
import type { CaptureTexts } from './capture-texts'
import type { OcrRecognition } from './ocr-worker-recognition'
import { recognizeRaidRows, type RaidSlotRecognition } from './raid-recognition'
import { reportRendererDiagnostic, showRejectedOcrNickname } from './runtime-diagnostics'

const READY_STATUS = '캡처 버튼을 눌러 공대를 인식해 주세요.'

type RaidCaptureInput = {
  texts: CaptureTexts
  beginSearch: (signal: AbortSignal) => Promise<string | null>
  readFrame: (captureId: string) => Promise<RaidFrameResult>
  observeOcr: (input: OcrCaptureObservation) => void
  recognizeWithOcr: OcrRecognition
}

type RaidCaptureContext = {
  effects: RaidCaptureInput
  sourceId: string | null
  captureId: string | null
  rows: readonly (RaidFrameRow | null)[]
  valueColumn: RaidValueColumn
  results: RaidSlotRecognition[]
  round: number
  startedRounds: number
  status: string
  completedAt: number | null
}

type RaidCaptureEvent =
  | { type: 'START' }
  | { type: 'PASTE' }
  | { type: 'SOURCE'; sourceId: string | null }

/**
 * 공대 화면의 캡처 회차. 파티 캡처처럼 공대 헤더의 캡처 버튼이 START를 보내고, 회차마다 공대
 * 수명을 새로 시작한 뒤 게임 창 프레임을 한 장만 읽어 12행 공대원 이름을 인식한다. 창 선택은 파티 캡처가
 * 소유하고 등록 결과를 SOURCE로 알린다. 등록된 창이 없으면 START를 받지 않고, 등록이 바뀌면 진행 중 회차를
 * 끝낸다. 그 회차가 이미 비운 슬롯은 비운 채로 두고 완료 시각도 지운다.
 */
export const raidCaptureMachine = setup({
  types: {
    context: {} as RaidCaptureContext,
    input: {} as RaidCaptureInput,
    events: {} as RaidCaptureEvent
  },
  actors: {
    beginSearch: beginCaptureSearch,
    readFrame: fromPromise(
      ({ input }: { input: { captureId: string; effects: RaidCaptureInput } }) =>
        input.effects.readFrame(input.captureId)
    ),
    recognize: fromPromise(
      ({
        input,
        signal
      }: {
        input: { rows: readonly (RaidFrameRow | null)[]; effects: RaidCaptureInput }
        signal: AbortSignal
      }) =>
        input.effects.recognizeWithOcr(signal, input.effects.texts.raidOcrFailed, (recognizeText) =>
          recognizeRaidRows(input.rows, recognizeText)
        )
    )
  },
  guards: {
    hasSource: ({ context }) => context.sourceId !== null
  },
  actions: {
    recordSource: assign({
      sourceId: ({ event }) => {
        if (event.type !== 'SOURCE') {
          return null
        }

        return event.sourceId
      }
    }),
    countStart: assign({ startedRounds: ({ context }) => context.startedRounds + 1 }),
    cancelRound: assign({ status: READY_STATUS, completedAt: null }),
    resetRecognition: assign({
      captureId: null,
      rows: [],
      valueColumn: 'unknown',
      results: [],
      round: ({ context }) => context.round + 1
    }),
    applyRecognition: ({ context }) => {
      for (const result of context.results) {
        if (result.kind === 'missing' || result.kind === 'failed') {
          continue
        }
        const { slot, jobText } = result
        const raidRow = {
          jobText,
          valueColumn: context.valueColumn,
          valueText: context.rows[slot]?.valueText ?? null
        }
        if (result.kind === 'rejected') {
          showRejectedOcrNickname(result)
        }
        const nickname = getObservedNickname(result)
        context.effects.observeOcr({
          slot,
          nickname,
          candidateNicknames: [nickname],
          portrait: null,
          raidRow
        })
      }
    }
  }
}).createMachine({
  id: 'raidCapture',
  initial: 'idle',
  context: ({ input }) => ({
    effects: input,
    sourceId: null,
    captureId: null,
    rows: [],
    valueColumn: 'unknown',
    results: [],
    round: 0,
    startedRounds: 0,
    status: READY_STATUS,
    completedAt: null
  }),
  // 등록 변경은 어느 상태에서든 기록한다. 진행 중 상태는 아래에서 회차 취소를 함께 정한다.
  on: {
    SOURCE: { actions: 'recordSource' },
    // 붙여 넣은 프레임은 host가 들고 있다가 readFrame으로 돌려주므로 등록된 창 없이 회차를 시작한다.
    PASTE: { target: '.capturing', actions: 'countStart' }
  },
  states: {
    idle: {
      on: { START: { guard: 'hasSource', target: 'capturing', actions: 'countStart' } }
    },
    capturing: {
      initial: 'search',
      entry: ['resetRecognition', assign({ status: '공대를 인식하고 있습니다.' })],
      on: {
        START: { guard: 'hasSource', target: 'capturing', reenter: true, actions: 'countStart' },
        PASTE: { target: 'capturing', reenter: true, actions: 'countStart' }
      },
      states: {
        search: {
          tags: ['busy'],
          // 공대 수명의 begin 응답이 도착할 때까지 중복 시작을 막는다.
          on: {
            START: {},
            PASTE: {},
            SOURCE: { target: '#raidCapture.idle', actions: ['recordSource', 'cancelRound'] }
          },
          invoke: {
            src: 'beginSearch',
            input: ({ context }) => context.effects,
            onDone: {
              target: 'frame',
              actions: assign({ captureId: ({ event }) => event.output })
            },
            onError: {
              target: '#raidCapture.failed',
              actions: [
                () => reportRendererDiagnostic('CAPTURE_START_FAILED'),
                assign({ status: ({ context }) => context.effects.texts.raidStartFailed })
              ]
            }
          }
        },
        frame: {
          tags: ['busy'],
          on: {
            SOURCE: { target: '#raidCapture.idle', actions: ['recordSource', 'cancelRound'] }
          },
          invoke: {
            src: 'readFrame',
            // 검색 시작 actor의 성공 전이에서만 captureId가 기록된다.
            input: ({ context }) => ({ captureId: context.captureId!, effects: context.effects }),
            onDone: [
              {
                guard: ({ event }) => event.output.kind === 'rows',
                target: 'recognizing',
                actions: assign(({ event }) => {
                  if (event.output.kind !== 'rows') {
                    return {}
                  }

                  return { rows: event.output.rows, valueColumn: event.output.valueColumn }
                })
              },
              {
                guard: ({ event }) => event.output.kind === 'missing',
                target: 'unavailable',
                actions: assign({
                  status: ({ context, event }) => {
                    if (event.output.kind === 'missing' && event.output.reason === 'not-found') {
                      return context.effects.texts.raidWindowMissing
                    }

                    return context.effects.texts.raidWindowUncertain
                  }
                })
              }
            ],
            onError: {
              target: '#raidCapture.failed',
              actions: [
                () => reportRendererDiagnostic('CAPTURE_READ_FAILED'),
                assign({ status: ({ context }) => context.effects.texts.disconnected })
              ]
            }
          }
        },
        recognizing: {
          tags: ['busy'],
          on: {
            SOURCE: { target: '#raidCapture.idle', actions: ['recordSource', 'cancelRound'] }
          },
          invoke: {
            src: 'recognize',
            // frame 상태의 성공 전이에서 확보한 회차의 크롭만 인식한다.
            input: ({ context }) => ({ rows: context.rows, effects: context.effects }),
            onDone: [
              {
                guard: ({ event }) => event.output.some((result) => result.kind === 'failed'),
                target: '#raidCapture.failed',
                actions: [
                  () => reportRendererDiagnostic('OCR_FAILED'),
                  assign({ status: ({ context }) => context.effects.texts.raidOcrFailed })
                ]
              },
              {
                guard: ({ event }) => event.output.every((result) => result.kind === 'missing'),
                target: 'unavailable',
                actions: assign({ status: ({ context }) => context.effects.texts.raidNamesMissing })
              },
              {
                target: 'complete',
                actions: [assign({ results: ({ event }) => event.output }), 'applyRecognition']
              }
            ],
            onError: {
              target: '#raidCapture.failed',
              actions: [
                () => reportRendererDiagnostic('OCR_FAILED'),
                assign({
                  status: ({ context, event }) =>
                    getRecognizeErrorStatus(event.error, context.effects.texts.raidOcrFailed)
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
    failed: {
      on: { START: { guard: 'hasSource', target: 'capturing', actions: 'countStart' } }
    }
  }
})

export function getRaidCapturePhase(
  snapshot: SnapshotFrom<typeof raidCaptureMachine>
): Extract<CapturePhase, 'idle' | 'recognizing' | 'complete' | 'unavailable' | 'failed'> {
  if (snapshot.matches('capturing')) {
    return getCapturingPhase(snapshot)
  }

  if (snapshot.matches('failed')) {
    return 'failed'
  }

  return 'idle'
}
