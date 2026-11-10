import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import type { ScoreWorkerData, ScoreWorkerMessage, ScoreWorkerRequest } from './worker-protocol.js'
import { type NativeScore, openNativeScore } from './native.js'
import { SCORE_WARMUP_INPUT } from './warmup-input.js'

export type ScoreWorkerPort = {
  postMessage: (message: ScoreWorkerMessage) => void
  on(event: 'message', listener: (request: ScoreWorkerRequest) => void): unknown
}

export function serveScoreRequests(port: ScoreWorkerPort, score: NativeScore | null): void {
  if (score === null) {
    port.postMessage({ kind: 'unavailable' })

    return
  }
  // 첫 계산 초기화는 thread마다 따로 들므로, 이후 요청을 계산할 이 thread에서 두 계산기를 먼저 한 번씩 부른다.
  // 그동안 도착한 요청은 port에 쌓였다가 아래 listener를 붙인 뒤 차례로 계산한다.
  score(SCORE_WARMUP_INPUT, 'equipment')
  score(SCORE_WARMUP_INPUT, 'buff')
  port.on('message', (request) => {
    port.postMessage({
      kind: 'result',
      id: request.id,
      text: score(request.input, request.calculator)
    })
  })
}

// 테스트가 main thread에서 serveScoreRequests를 import할 때는 시작하지 않는다.
if (!isMainThread && parentPort !== null) {
  const { path } = workerData as ScoreWorkerData
  serveScoreRequests(parentPort, openNativeScore({ path }))
}
