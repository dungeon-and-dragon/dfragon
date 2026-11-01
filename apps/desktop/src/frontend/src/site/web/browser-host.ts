import ky from 'ky'
import { parseTodayGrade } from '../../../../preload/common/today-grade'
import {
  DIAGNOSTIC_HISTORY_LIMIT,
  type DiagnosticApi,
  type DiagnosticCode,
  type DiagnosticEntry
} from '../../../../preload/common/types/diagnostics'
import type { TodayGrade } from '../../../../preload/common/types/today-grade'
import type { UpdateNoticeSnapshot } from '../../../../preload/common/types/update-notice'
import { startRendererDiagnostics } from '../../lib/runtime-diagnostics'
import { createBrowserCardSearch, createBrowserSearchRuntime } from './browser-search'

// 응답은 `{ percent, expiresAt }` 하나라 100바이트 안팎이다.
const TODAY_GRADE_MAX_BYTES = 4 * 1024
const NO_UPDATE_NOTICE: UpdateNoticeSnapshot = { revision: 0, notice: null }

type BrowserDiagnostics = DiagnosticApi & { report: (code: DiagnosticCode) => void }

function createMemoryDiagnostics(): BrowserDiagnostics {
  const entries: DiagnosticEntry[] = []
  const listeners = new Set<(entry: DiagnosticEntry) => void>()
  let sequence = 0

  function report(code: DiagnosticCode): void {
    if (entries.at(-1)?.code === code) {
      return
    }
    sequence += 1
    const entry = Object.freeze({ sequence, timestamp: Date.now(), code })
    entries.push(entry)
    if (entries.length > DIAGNOSTIC_HISTORY_LIMIT) {
      entries.shift()
    }
    for (const listener of listeners) {
      listener(entry)
    }
  }

  return {
    report,
    getDiagnosticHistory: async () => entries.slice(),
    reportRendererDiagnostic: async (code) => report(code),
    onDiagnosticEntry: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    }
  }
}

async function readTodayGrade(apiOrigin: string): Promise<TodayGrade> {
  const body = await ky
    .get(`${apiOrigin}/items/today-grade`, {
      retry: 0,
      maxResponseSize: TODAY_GRADE_MAX_BYTES,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store'
    })
    .json()
  const grade = parseTodayGrade(body)
  if (grade == null) {
    throw new Error('INVALID_TODAY_GRADE_RESPONSE')
  }

  return grade
}

function noCaptureFrame(): Promise<never> {
  return Promise.reject(new Error('CAPTURE_NOT_ALLOWED'))
}

export function installBrowserHost(apiOrigin: string): void {
  const diagnostics = createMemoryDiagnostics()
  const runtime = createBrowserSearchRuntime(apiOrigin, diagnostics.report)
  const party = createBrowserCardSearch('party', runtime)
  const raid = createBrowserCardSearch('raid', runtime)

  window.api = {
    listCaptureSources: async () => [],
    selectCaptureSource: async () => null,
    readCaptureFrame: noCaptureFrame,
    notifyOcrCandidatesDetected: party.notifyOcrCandidatesDetected
  }
  window.search = {
    controlCharacterSearch: party.controlCharacterSearch,
    onCharacterSearchChanged: party.onCharacterSearchChanged
  }
  window.raidSearch = { ...raid, readCaptureFrame: noCaptureFrame }
  window.desktopShortcut = { onDesktopShortcut: () => () => {} }
  // 보안 컨텍스트가 아니면 navigator.clipboard가 없으므로, async로 감싸 그 TypeError도 복사 실패로 보이게 한다.
  window.desktopClipboard = {
    writeText: async (text) => {
      await navigator.clipboard.writeText(text)
    }
  }
  window.todayGrade = { getTodayGrade: () => readTodayGrade(apiOrigin) }
  window.diagnostics = diagnostics
  window.updateNotice = {
    getUpdateNotice: async () => NO_UPDATE_NOTICE,
    dismissUpdateNotice: async () => NO_UPDATE_NOTICE,
    openUpdateRelease: async () => {},
    onUpdateNoticeChanged: () => () => {}
  }
  window.windowChrome = { setContentHeight: async () => {} }
  startRendererDiagnostics(diagnostics)
}
