import type { Writable } from 'node:stream'

export type AccessLogSink = (line: string) => void

function dropStreamError(): void {
  // 닫힌 log pipe의 EPIPE 같은 쓰기 오류는 접근 로그 한 줄을 잃는 것으로 끝낸다.
}

/**
 * 첫 쓰기 때 오류 listener를 두어, stdout pipe가 닫혀도 처리되지 않은 `error` event로 서버 process가 끝나지 않게 한다.
 */
export function createStreamAccessLogSink(stream: Writable): AccessLogSink {
  let isWatchingErrors = false

  return (line) => {
    if (!isWatchingErrors) {
      stream.on('error', dropStreamError)
      isWatchingErrors = true
    }
    stream.write(`${line}\n`)
  }
}

export const writeAccessLogToStdout = createStreamAccessLogSink(process.stdout)

export type ReportCode = (code: string) => void

export function createCodeReport(sink: AccessLogSink, service: string): ReportCode {
  return (code) => sink(JSON.stringify({ time: new Date().toISOString(), service, code }))
}
