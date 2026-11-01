import ky from 'ky'
import { parseTodayGrade } from '../../../../preload/common/today-grade'
import type { CaptureSource, WindowFrameResult } from '../../../../preload/common/types/capture'
import type { CharacterImage } from '../../../../preload/common/types/character'
import type { DesktopShortcut } from '../../../../preload/common/types/desktop-shortcut'
import {
  DIAGNOSTIC_HISTORY_LIMIT,
  type DiagnosticApi,
  type DiagnosticCode,
  type DiagnosticEntry
} from '../../../../preload/common/types/diagnostics'
import type { TodayGrade } from '../../../../preload/common/types/today-grade'
import type { UpdateNoticeSnapshot } from '../../../../preload/common/types/update-notice'
import { toRaidFrameResult } from '../../../../shared/raid/raid-frame'
import { startRendererDiagnostics } from '../../lib/runtime-diagnostics'
import { decodeBrowserImage } from './browser-png'
import { readRaidWindowTemplates } from './browser-raid-templates'
import { createBrowserCardSearch, createBrowserSearchRuntime } from './browser-search'

// 응답은 `{ percent, expiresAt }` 하나라 100바이트 안팎이다.
const TODAY_GRADE_MAX_BYTES = 4 * 1024
const NO_UPDATE_NOTICE: UpdateNoticeSnapshot = { revision: 0, notice: null }
// 한글 자판에서는 Alt+W의 key가 'ㅈ'이므로 물리 키로 고른다.
const PAGE_SHORTCUTS: Readonly<Record<string, DesktopShortcut>> = {
  KeyW: 'take-snapshot',
  KeyA: 'copy-clipboard',
  KeyR: 'restart-search'
}

export type BrowserHost = {
  onPastedFrame: (listener: () => void) => () => void
  requestScreenShare: () => Promise<string | null>
  onScreenShareEnded: (listener: () => void) => () => void
}

type ScreenShare = { id: string; track: MediaStreamTrack; video: HTMLVideoElement }

type BrowserDiagnostics = DiagnosticApi & { report: (code: DiagnosticCode) => void }

function createListeners<T extends unknown[]>(): {
  subscribe: (listener: (...args: T) => void) => () => void
  notify: (...args: T) => void
} {
  const listeners = new Set<(...args: T) => void>()

  return {
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    notify(...args) {
      for (const listener of listeners) {
        listener(...args)
      }
    }
  }
}

function createMemoryDiagnostics(): BrowserDiagnostics {
  const entries: DiagnosticEntry[] = []
  const listeners = createListeners<[DiagnosticEntry]>()
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
    listeners.notify(entry)
  }

  return {
    report,
    getDiagnosticHistory: async () => entries.slice(),
    reportRendererDiagnostic: async (code) => report(code),
    onDiagnosticEntry: listeners.subscribe
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

function findPastedImage(data: DataTransfer | null): File | null {
  for (const item of Array.from(data?.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

function createScreenShare(): {
  isConnected: () => boolean
  request: BrowserHost['requestScreenShare']
  select: (sourceId: string) => CaptureSource | null
  read: () => Promise<CharacterImage>
  onEnded: BrowserHost['onScreenShareEnded']
} {
  let current: ScreenShare | null = null
  let shareCount = 0
  const ended = createListeners<[]>()

  // track.stop()은 ended 이벤트를 보내지 않으므로, 앱이 끊은 공유는 끝났다고 다시 알리지 않는다.
  function stop(): void {
    current?.track.stop()
    current = null
  }

  return {
    isConnected: () => current !== null,
    async request() {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'window' },
          audio: false
        })
      } catch {
        // 공유 창을 닫거나 거절하면 지금 연결을 그대로 둔다.
        return null
      }
      const [track] = stream.getVideoTracks()
      const video = document.createElement('video')
      video.muted = true
      video.srcObject = stream
      await video.play()
      stop()
      shareCount += 1
      const share: ScreenShare = { id: `screen-share-${shareCount}`, track, video }
      track.addEventListener('ended', () => {
        if (current === share) {
          current = null
          ended.notify()
        }
      })
      current = share

      return share.id
    },
    select(sourceId) {
      if (sourceId === '') {
        stop()

        return null
      }

      if (current?.id !== sourceId) {
        throw new Error('SCREEN_SHARE_ENDED')
      }

      return { id: current.id, name: current.track.label }
    },
    read() {
      if (current === null) {
        return Promise.reject(new Error('SCREEN_SHARE_ENDED'))
      }

      // 재생 중인 video의 지금 프레임을 읽어, 화면이 바뀌지 않아 새 프레임이 오지 않아도 기다리지 않는다.

      return decodeBrowserImage(current.video)
    },
    onEnded: ended.subscribe
  }
}

// 붙여 넣은 이미지는 host가 들고 있다가 renderer가 시작한 회차의 readCaptureFrame으로 돌려준다. 공유한 창이 있으면
// 붙여넣기로 시작한 회차만 그 이미지를 읽고, 캡처 버튼과 Alt+R 회차는 공유 화면을 읽는다.
function createPastedFrames(share: ReturnType<typeof createScreenShare>): {
  read: () => Promise<WindowFrameResult>
  install: () => BrowserHost['onPastedFrame']
} {
  let frame: Promise<CharacterImage> | null = null
  let pastedRoundPending = false
  const pasted = createListeners<[]>()

  function readImage(): Promise<CharacterImage> {
    const readsPasted = pastedRoundPending || !share.isConnected()
    pastedRoundPending = false
    if (!readsPasted) {
      return share.read()
    }

    if (frame === null) {
      return Promise.reject(new Error('NO_PASTED_FRAME'))
    }

    return frame
  }

  return {
    read() {
      return readImage().then((image) => ({ kind: 'frame', image }))
    },
    install() {
      document.addEventListener('paste', (event) => {
        const image = findPastedImage(event.clipboardData)
        if (image === null) {
          return
        }
        frame = decodeBrowserImage(image)
        // 디코딩 실패는 회차의 readCaptureFrame이 받아 안내하므로 여기서는 미처리 거절로 남기지 않는다.
        frame.catch(() => undefined)
        pastedRoundPending = true
        pasted.notify()
      })

      return pasted.subscribe
    }
  }
}

function installPageShortcuts(
  canRestart: () => boolean
): (listener: (shortcut: DesktopShortcut) => void) => () => void {
  const shortcuts = createListeners<[DesktopShortcut]>()
  document.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) {
      return
    }
    const shortcut = PAGE_SHORTCUTS[event.code]
    // Alt+R은 공유한 창이 있을 때만 받는다. 붙여넣기만 있으면 다시 읽을 화면이 없다.
    if (shortcut === undefined || (shortcut === 'restart-search' && !canRestart())) {
      return
    }
    event.preventDefault()
    shortcuts.notify(shortcut)
  })

  return shortcuts.subscribe
}

export function installBrowserHost(apiOrigin: string): BrowserHost {
  const diagnostics = createMemoryDiagnostics()
  const runtime = createBrowserSearchRuntime(apiOrigin, diagnostics.report)
  const party = createBrowserCardSearch('party', runtime)
  const raid = createBrowserCardSearch('raid', runtime)
  const screenShare = createScreenShare()
  const pastedFrames = createPastedFrames(screenShare)

  // 공유는 게임 연결 칩을 눌렀을 때만 요청한다. 목록 재조회가 공유 창을 띄우지 않도록 목록은 늘 비운다.
  window.api = {
    listCaptureSources: async () => [],
    selectCaptureSource: async (sourceId) => screenShare.select(sourceId),
    readCaptureFrame: pastedFrames.read,
    notifyOcrCandidatesDetected: party.notifyOcrCandidatesDetected
  }
  window.search = {
    controlCharacterSearch: party.controlCharacterSearch,
    onCharacterSearchChanged: party.onCharacterSearchChanged
  }
  window.raidSearch = {
    ...raid,
    readCaptureFrame: async () =>
      toRaidFrameResult(await pastedFrames.read(), await readRaidWindowTemplates())
  }
  window.desktopShortcut = { onDesktopShortcut: installPageShortcuts(screenShare.isConnected) }
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

  return {
    onPastedFrame: pastedFrames.install(),
    requestScreenShare: screenShare.request,
    onScreenShareEnded: screenShare.onEnded
  }
}
