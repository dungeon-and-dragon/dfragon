// @vitest-environment jsdom
import { afterEach, expect, it, vi, type MockInstance } from 'vitest'
import { reportRendererDiagnostic, startRendererDiagnostics } from './runtime-diagnostics'

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'))
  vi.restoreAllMocks()
})

function fixture(): {
  report: ReturnType<typeof startRendererDiagnostics>
  warn: MockInstance<typeof console.warn>
} {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  return { report: startRendererDiagnostics(), warn }
}

it('보고한 코드를 순서대로 Console에 표시하고 바로 앞과 같은 코드는 한 번만 표시한다', () => {
  const f = fixture()
  f.report('OCR_FAILED')
  reportRendererDiagnostic('OCR_FAILED')
  f.report('SEARCH_TIMEOUT')
  reportRendererDiagnostic('OCR_FAILED')

  expect(f.warn.mock.calls.map(([message]) => message)).toEqual([
    expect.stringContaining('OCR_FAILED: 닉네임 인식을 완료하지 못했습니다.'),
    expect.stringContaining('SEARCH_TIMEOUT: 캐릭터 조회 시간이 초과되었습니다.'),
    expect.stringContaining('OCR_FAILED: 닉네임 인식을 완료하지 못했습니다.')
  ])
})

it('화면 원문 오류와 거부 이유를 읽지 않고 분류된 코드만 표시한다', () => {
  const f = fixture()
  const error = new Event('error')
  Object.defineProperty(error, 'message', {
    get: () => {
      throw new Error('must not read raw error')
    }
  })
  window.dispatchEvent(error)
  window.dispatchEvent(new Event('unhandledrejection'))
  reportRendererDiagnostic('CAPTURE_START_FAILED')

  expect(f.warn.mock.calls.map(([message]) => message)).toEqual([
    expect.stringContaining('RENDERER_ERROR: '),
    expect.stringContaining('RENDERER_REJECTION: '),
    expect.stringContaining('CAPTURE_START_FAILED: ')
  ])
})

it('페이지를 떠나면 화면 오류 관찰을 정리하고 늦은 보고를 표시하지 않는다', () => {
  const f = fixture()
  window.dispatchEvent(new Event('pagehide'))
  window.dispatchEvent(new Event('error'))
  reportRendererDiagnostic('OCR_FAILED')
  f.report('SEARCH_FAILED')

  expect(f.warn).not.toHaveBeenCalled()
})
