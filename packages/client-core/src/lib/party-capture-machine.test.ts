import { createActor, waitFor } from 'xstate'
import { afterEach, expect, it, vi } from 'vitest'
import { partyCaptureMachine } from './party-capture-machine'
import { DESKTOP_CAPTURE_TEXTS } from './capture-texts'
import { createSharedOcrWorker } from './ocr-worker-recognition'
import type { WindowFrameResult } from '../preload/common/types/capture'

const modules = vi.hoisted(() => ({ diagnostic: vi.fn() }))
vi.mock('./ocr', () => ({ createPartyOcrWorker: vi.fn() }))
vi.mock('./runtime-diagnostics', () => ({
  reportRendererDiagnostic: modules.diagnostic,
  showRejectedOcrNickname: vi.fn()
}))

const CAPTURE_ID = '00000000-0000-4000-8000-000000000001'

function start() {
  const effects = {
    texts: DESKTOP_CAPTURE_TEXTS,
    selectSource: vi.fn(async (_sourceId: string): Promise<unknown> => undefined),
    beginSearch: vi.fn(async (_signal: AbortSignal): Promise<string | null> => CAPTURE_ID),
    endSearch: vi.fn(),
    readFrame: vi.fn(
      async (_captureId: string): Promise<WindowFrameResult> => ({
        kind: 'unsupported'
      })
    ),
    observeOcr: vi.fn(),
    recognizeWithOcr: createSharedOcrWorker(DESKTOP_CAPTURE_TEXTS.ocrPrepareFailed).recognize
  }
  const actor = createActor(partyCaptureMachine, { input: effects }).start()

  return { actor, effects }
}

afterEach(() => {
  vi.resetAllMocks()
})

it('시작한 회차 수는 받아들인 START마다 오르고 창 선택과 중지는 세지 않는다', async () => {
  const { actor, effects } = start()
  const pendingFrame = Promise.withResolvers<WindowFrameResult>()
  effects.readFrame.mockReturnValueOnce(pendingFrame.promise)
  const startedRounds = () => actor.getSnapshot().context.startedRounds

  actor.send({ type: 'SELECT', sourceId: 'game' })
  await waitFor(actor, (state) => state.matches('selected'))
  expect(startedRounds()).toBe(0)

  actor.send({ type: 'START' })
  expect(startedRounds()).toBe(1)

  actor.send({ type: 'START' })
  expect(startedRounds()).toBe(1)

  await waitFor(actor, (state) => state.matches({ capturing: 'frame' }))
  actor.send({ type: 'START' })
  expect(startedRounds()).toBe(2)

  await waitFor(actor, (state) => state.matches('captureFailed'))
  expect(startedRounds()).toBe(2)
  actor.send({ type: 'START' })
  expect(startedRounds()).toBe(3)

  await waitFor(actor, (state) => state.matches('captureFailed'))
  actor.send({ type: 'STOP' })
  expect(startedRounds()).toBe(3)
  actor.send({ type: 'SELECT', sourceId: 'game' })
  expect(startedRounds()).toBe(3)
})

it('붙여 넣은 프레임은 창을 고르지 않아도 회차를 시작하고 host가 든 프레임을 읽는다', async () => {
  const { actor, effects } = start()
  const frame = { width: 1, height: 1, rgba: new Uint8Array([0, 0, 0, 255]) }
  effects.readFrame.mockResolvedValue({ kind: 'frame', image: frame })
  const startedRounds = () => actor.getSnapshot().context.startedRounds

  actor.send({ type: 'PASTE' })
  expect(effects.beginSearch).toHaveBeenCalledOnce()
  expect(startedRounds()).toBe(1)
  expect(actor.getSnapshot().context.status).toBe('파티를 인식하고 있습니다.')

  actor.send({ type: 'PASTE' })
  expect(startedRounds()).toBe(1)

  await vi.waitFor(() => expect(effects.readFrame).toHaveBeenCalledWith(CAPTURE_ID))
  expect(effects.selectSource).not.toHaveBeenCalled()
  expect(actor.getSnapshot().context.selectedSourceId).toBe('')
  await waitFor(actor, (state) => !state.matches({ capturing: 'search' }))

  actor.send({ type: 'PASTE' })
  expect(startedRounds()).toBe(2)
  expect(effects.beginSearch).toHaveBeenCalledTimes(2)
})
