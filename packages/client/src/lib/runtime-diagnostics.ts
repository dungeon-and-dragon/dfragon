import { PRODUCT_NAME } from '@dfragon/lib'
import {
  DIAGNOSTIC_MESSAGES,
  type DiagnosticCode
} from '@dfragon/client-core/preload/common/types/diagnostics'

let activeReport: ((code: DiagnosticCode) => void) | null = null

const OCR_NICKNAME_REJECTION_REASONS = {
  missing: '후보 없음',
  empty: '빈 문자열',
  'too-long': '최대 길이 초과',
  malformed: '잘못된 Unicode'
} as const

export type OcrNicknameRejection = keyof typeof OCR_NICKNAME_REJECTION_REASONS

export function showRejectedOcrNickname({
  slot,
  text,
  rejection
}: {
  slot: number
  text: string | null
  rejection: OcrNicknameRejection
}): void {
  const time = new Date().toLocaleTimeString()
  // 앞뒤 공백과 잘못된 Unicode가 보이도록 JSON 문자열로 표시한다.
  const original = text !== null ? JSON.stringify(text) : '없음'
  console.warn(
    `[${PRODUCT_NAME} ${time}] 슬롯 ${slot + 1}의 OCR 첫 후보를 검색에 쓰지 못했습니다. 이유: ${OCR_NICKNAME_REJECTION_REASONS[rejection]}, 원문: ${original}`
  )
}

export function reportRendererDiagnostic(code: DiagnosticCode): void {
  activeReport?.(code)
}

export function startRendererDiagnostics(): (code: DiagnosticCode) => void {
  let disposed = false
  let lastCode: DiagnosticCode | null = null

  function report(code: DiagnosticCode): void {
    if (disposed || code === lastCode) {
      return
    }
    lastCode = code
    const time = new Date().toLocaleTimeString()
    console.warn(`[${PRODUCT_NAME} ${time}] ${code}: ${DIAGNOSTIC_MESSAGES[code]}`)
  }
  activeReport = report

  const onError = (): void => reportRendererDiagnostic('RENDERER_ERROR')
  const onRejection = (): void => reportRendererDiagnostic('RENDERER_REJECTION')
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  function dispose(): void {
    disposed = true
    if (activeReport === report) {
      activeReport = null
    }
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('pagehide', dispose)
  }
  window.addEventListener('pagehide', dispose)

  return report
}
